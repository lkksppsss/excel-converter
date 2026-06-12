import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import StepHeader from '../components/genericTemplateFill/StepHeader'
import SourceStructureStep from '../components/genericTemplateFill/SourceStructureStep'
import TargetStructureStep from '../components/genericTemplateFill/TargetStructureStep'
import MappingRulesStep from '../components/genericTemplateFill/MappingRulesStep'
import PreviewExportStep from '../components/genericTemplateFill/PreviewExportStep'
import { useSessionState } from '../utils/useSessionState'
import { getSheetNames, getSheetBounds } from '../utils/genericTemplateFill/workbookReader'
import { extractSourceRows, getFieldDefs } from '../utils/genericTemplateFill/sourceTable'
import {
  buildCellWrites,
  applyWritesToWorksheet,
  workbookToXlsxBlob,
} from '../utils/genericTemplateFill/fillEngine'
import styles from './GenericTemplateFillPage.module.css'

const STEPS = [
  { key: 'source', label: '來源結構' },
  { key: 'target', label: '目標結構' },
  { key: 'mapping', label: '對應規則' },
  { key: 'preview', label: '預覽匯出' },
]

// 通用範本填入流程（規格書功能 2）。
// 每個步驟有自己的 URL（/template-fill/:step），瀏覽器上一頁 = 回上一步。
// 範圍與規則設定存 sessionStorage，重整後只需重新上傳檔案；workbook 二進位不持久化。
export default function GenericTemplateFillPage() {
  const navigate = useNavigate()
  const { step } = useParams()

  // Excel 二進位（記憶體，重整即消失）
  const [sourceWorkbook, setSourceWorkbook] = useState(null)
  const [targetWorkbook, setTargetWorkbook] = useState(null)

  // 設定（sessionStorage，跨重整保留）
  const [sourceConfig, setSourceConfig] = useSessionState('templateFill.sourceConfig', null)
  const [targetConfig, setTargetConfig] = useSessionState('templateFill.targetConfig', null)
  const [mappingRules, setMappingRules] = useSessionState('templateFill.mappingRules', [])

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // ── 衍生資料 ──
  const sourceSheetNames = useMemo(
    () => (sourceWorkbook ? getSheetNames(sourceWorkbook) : []),
    [sourceWorkbook]
  )

  // 欄位定義（名稱 + 各自的資料範圍）直接存在 config，重整後不需 workbook 即可顯示
  const sourceFields = useMemo(() => getFieldDefs(sourceConfig), [sourceConfig])

  const sourceRows = useMemo(() => {
    if (!sourceWorkbook || sourceFields.length === 0) return []
    try {
      return extractSourceRows(sourceWorkbook, sourceConfig)
    } catch {
      return []
    }
  }, [sourceWorkbook, sourceConfig, sourceFields])

  // ── 步驟守門：尚未完成前置步驟時導回最早未完成的步驟 ──
  const isSourceDone = Boolean(sourceWorkbook && sourceFields.length > 0)
  const isTargetDone = Boolean(targetWorkbook && targetConfig?.fillZones?.length > 0)
  const isMappingDone = mappingRules.length > 0
  const maxReachableIndex = !isSourceDone ? 0 : !isTargetDone ? 1 : !isMappingDone ? 2 : 3

  const currentIndex = STEPS.findIndex((s) => s.key === (step || 'source'))
  if (currentIndex === -1 || currentIndex > maxReachableIndex) {
    return <Navigate to={`/template-fill/${STEPS[Math.max(maxReachableIndex, 0)].key}`} replace />
  }

  function goToStep(index) {
    navigate(`/template-fill/${STEPS[index].key}`)
  }

  async function handleExport() {
    setIsExporting(true)
    setExportError('')
    try {
      const { writes } = buildCellWrites({
        sourceRows,
        mappingRules,
        fillZones: targetConfig.fillZones,
        targetBounds: getSheetBounds(targetWorkbook, targetConfig.sheetName),
      })
      const worksheet = targetWorkbook.getWorksheet(targetConfig.sheetName)
      applyWritesToWorksheet(worksheet, writes)
      const blob = await workbookToXlsxBlob(targetWorkbook)
      saveAs(blob, '範本填入結果.xlsx')
    } catch (e) {
      setExportError(`匯出失敗：${e.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const currentKey = STEPS[currentIndex].key

  return (
    <div className={styles.page}>
      <StepHeader
        steps={STEPS}
        currentIndex={currentIndex}
        maxReachableIndex={maxReachableIndex}
        onStepClick={goToStep}
      />

      {currentKey === 'source' && (
        <SourceStructureStep
          workbook={sourceWorkbook}
          config={sourceConfig}
          onWorkbookReady={(wb) => setSourceWorkbook(wb)}
          onConfigChange={setSourceConfig}
          onNext={() => goToStep(1)}
        />
      )}

      {currentKey === 'target' && (
        <TargetStructureStep
          workbook={targetWorkbook}
          config={targetConfig}
          onWorkbookReady={(wb) => setTargetWorkbook(wb)}
          onConfigChange={setTargetConfig}
          onNext={() => goToStep(2)}
          onBack={() => goToStep(0)}
        />
      )}

      {currentKey === 'mapping' && (
        <MappingRulesStep
          sourceFields={sourceFields}
          sourceSheetNames={sourceSheetNames}
          allowSheetCondition={Boolean(sourceConfig?.applyToAllSheets) && sourceSheetNames.length > 1}
          fillZones={targetConfig.fillZones}
          rules={mappingRules}
          onRulesChange={setMappingRules}
          onNext={() => goToStep(3)}
          onBack={() => goToStep(1)}
        />
      )}

      {currentKey === 'preview' && (
        <PreviewExportStep
          targetWorkbook={targetWorkbook}
          targetConfig={targetConfig}
          sourceRows={sourceRows}
          mappingRules={mappingRules}
          isExporting={isExporting}
          exportError={exportError}
          onExport={handleExport}
          onBack={() => goToStep(2)}
        />
      )}
    </div>
  )
}
