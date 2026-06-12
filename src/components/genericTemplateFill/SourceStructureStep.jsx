import { useMemo, useState } from 'react'
import FileDropZone from '../common/FileDropZone'
import ExcelTableRenderer from '../common/ExcelTableRenderer'
import { zoneHighlightType } from '../common/excelTableHighlight'
import SheetTabs from './SheetTabs'
import { readWorkbookFromFile, getSheetNames, getSheetModel } from '../../utils/genericTemplateFill/workbookReader'
import { buildFieldDefs, getFieldDefs, validateRangeInput } from '../../utils/genericTemplateFill/sourceTable'
import styles from './SourceStructureStep.module.css'

let fieldIdCounter = 0
function nextFieldId() {
  fieldIdCounter += 1
  return `field-${fieldIdCounter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 步驟 1：上傳來源 Excel，逐一定義欄位 ——「標題範圍 ↔ 資料範圍」成對新增。
 * 表格框選只是把座標填進輸入框，超出顯示範圍的座標（例：A2:A500）可直接手動輸入。
 *
 * @param {object}   props.workbook        ExcelJS workbook（重整後為 null，需重新上傳）
 * @param {object}   props.config          sourceConfig（見 utils/genericTemplateFill/sourceTable.js）
 * @param {Function} props.onWorkbookReady (workbook, fileName) => void
 * @param {Function} props.onConfigChange  (config) => void
 * @param {Function} props.onNext
 */
export default function SourceStructureStep({
  workbook,
  config,
  onWorkbookReady,
  onConfigChange,
  onNext,
}) {
  const [file, setFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSheet, setActiveSheet] = useState(config?.sheetName || '')
  const [selectionMode, setSelectionMode] = useState('header') // 'header' | 'data'
  const [pendingHeader, setPendingHeader] = useState('')
  const [pendingData, setPendingData] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [formError, setFormError] = useState('')

  const sheetNames = useMemo(() => (workbook ? getSheetNames(workbook) : []), [workbook])
  const currentSheet = sheetNames.includes(activeSheet) ? activeSheet : sheetNames[0] || ''

  const model = useMemo(
    () => (workbook && currentSheet ? getSheetModel(workbook, currentSheet) : null),
    [workbook, currentSheet]
  )

  // 欄位定義標記在 config.sheetName 上；瀏覽其他工作表時不顯示高亮
  const isConfigSheet = config?.sheetName === currentSheet
  const fields = getFieldDefs(config)

  async function handleFile(selected) {
    setFile(selected)
    setError('')
    setIsLoading(true)
    try {
      const wb = await readWorkbookFromFile(selected)
      onWorkbookReady(wb, selected.name)
      const names = getSheetNames(wb)
      // 設定是針對同名工作表才有效，否則重設
      if (config && !names.includes(config.sheetName)) {
        onConfigChange(null)
        setActiveSheet(names[0])
      } else {
        setActiveSheet(config?.sheetName || names[0])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleRangeSelect(rangeA1) {
    setFormError('')
    if (selectionMode === 'header') {
      setPendingHeader(rangeA1)
      // 從標題格自動帶出名稱（單欄才帶，多欄會逐欄自動命名）
      try {
        const defs = buildFieldDefs(workbook, currentSheet, rangeA1, rangeA1)
        setFieldName(defs.length === 1 ? defs[0].name : '')
      } catch {
        setFieldName('')
      }
      setSelectionMode('data') // 標完標題接著框資料，減少一次點擊
    } else {
      setPendingData(rangeA1)
    }
  }

  function handleSheetSelect(name) {
    if (name === currentSheet) return
    if (
      fields.length > 0 &&
      !window.confirm('切換工作表會清除已定義的欄位，確定切換？')
    ) {
      return
    }
    setActiveSheet(name)
    setPendingHeader('')
    setPendingData('')
    if (fields.length > 0) {
      onConfigChange({ ...baseConfig(), sheetName: name, fields: [] })
    }
  }

  function baseConfig() {
    return {
      fileName: file?.name || config?.fileName,
      sheetName: currentSheet,
      applyToAllSheets: config?.applyToAllSheets || false,
      fields,
    }
  }

  function handleAddFields() {
    const headerError = validateRangeInput(pendingHeader)
    if (headerError) {
      setFormError(`標題範圍：${headerError}`)
      return
    }
    const dataError = validateRangeInput(pendingData)
    if (dataError) {
      setFormError(`資料範圍：${dataError}`)
      return
    }

    let defs
    try {
      defs = buildFieldDefs(workbook, currentSheet, pendingHeader.trim(), pendingData.trim())
    } catch {
      setFormError('無法解析範圍，請確認格式（例：A1、A1:C1、A:A）')
      return
    }
    if (defs.length === 0) {
      setFormError('這個標題範圍內沒有可用的欄位')
      return
    }
    // 單一欄位時，手動輸入的名稱優先於標題文字
    if (defs.length === 1 && fieldName.trim()) defs[0].name = fieldName.trim()

    // 與既有欄位名稱衝突時自動加序號
    const usedNames = new Set(fields.map((f) => f.name))
    const newFields = defs.map((def) => {
      let name = def.name
      let n = 2
      while (usedNames.has(name)) name = `${def.name} (${n++})`
      usedNames.add(name)
      return { ...def, name, id: nextFieldId() }
    })

    onConfigChange({ ...baseConfig(), sheetName: currentSheet, fields: [...fields, ...newFields] })
    setPendingHeader('')
    setPendingData('')
    setFieldName('')
    setSelectionMode('header')
    setFormError('')
  }

  function handleRemoveField(id) {
    onConfigChange({ ...baseConfig(), fields: fields.filter((f) => f.id !== id) })
  }

  const highlights = []
  if (isConfigSheet) {
    fields.forEach((f, i) => {
      highlights.push({ range: f.dataRange, type: zoneHighlightType(i) })
      if (f.headerRange) highlights.push({ range: f.headerRange, type: zoneHighlightType(i) })
    })
  }
  if (pendingHeader && !validateRangeInput(pendingHeader)) {
    highlights.push({ range: pendingHeader, type: 'header' })
  }
  if (pendingData && !validateRangeInput(pendingData)) {
    highlights.push({ range: pendingData, type: 'data' })
  }

  const canProceed = Boolean(workbook && fields.length > 0)

  if (!workbook) {
    return (
      <div className={styles.step}>
        <h2 className={styles.title}>步驟 1：設定來源結構</h2>
        <p className={styles.desc}>上傳含有資料的來源 Excel，接著定義每個欄位的標題與資料範圍</p>
        {fields.length > 0 && (
          <div className={styles.restoreNotice}>
            已保留先前定義的 {fields.length} 個欄位（{config.fileName}），重新上傳同一個檔案即可繼續
          </div>
        )}
        <div className={styles.dropWrapper}>
          <FileDropZone
            label="來源 Excel 檔案"
            hint="拖曳或點擊上傳 .xlsx / .xls / .csv"
            accept=".xlsx,.xls,.csv"
            file={file}
            error={error}
            isLoading={isLoading}
            onFile={handleFile}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.step}>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>步驟 1：設定來源結構</h2>
          <p className={styles.desc}>
            框選或輸入「標題範圍」與它的「資料範圍」，按「新增欄位」配對。多欄標題會自動逐欄拆成多個欄位
          </p>
        </div>
        <button type="button" className={styles.linkButton} onClick={() => onWorkbookReady(null, null)}>
          重新選擇檔案
        </button>
      </div>

      <div className={styles.builderPanel}>
        <div className={styles.builderRow}>
          <label
            className={`${styles.rangeGroup} ${selectionMode === 'header' ? styles.rangeGroupActiveHeader : ''}`}
          >
            <span className={styles.rangeLabel}>標題範圍</span>
            <input
              type="text"
              className={styles.rangeInput}
              placeholder="例：A1:F1"
              value={pendingHeader}
              onFocus={() => setSelectionMode('header')}
              onChange={(e) => {
                setPendingHeader(e.target.value)
                setFormError('')
              }}
            />
          </label>

          <label
            className={`${styles.rangeGroup} ${selectionMode === 'data' ? styles.rangeGroupActiveData : ''}`}
          >
            <span className={styles.rangeLabel}>資料範圍</span>
            <input
              type="text"
              className={styles.rangeInput}
              placeholder="例：A2:F500、A2:F（到底）"
              value={pendingData}
              onFocus={() => setSelectionMode('data')}
              onChange={(e) => {
                setPendingData(e.target.value)
                setFormError('')
              }}
            />
          </label>

          <label className={styles.rangeGroup}>
            <span className={styles.rangeLabel}>名稱</span>
            <input
              type="text"
              className={styles.nameInput}
              placeholder={pendingHeader ? '已從標題帶入，可修改' : '自訂欄位名稱'}
              value={fieldName}
              onChange={(e) => {
                setFieldName(e.target.value)
                setFormError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFields()
              }}
            />
          </label>

          <button
            type="button"
            className={styles.addButton}
            disabled={!pendingHeader || !pendingData}
            onClick={handleAddFields}
          >
            ＋ 新增欄位
          </button>

          {sheetNames.length > 1 && (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config?.applyToAllSheets || false}
                onChange={(e) => onConfigChange({ ...baseConfig(), applyToAllSheets: e.target.checked })}
              />
              相同欄位定義套用到所有工作表
            </label>
          )}
        </div>

        {formError && <div className={styles.formError}>{formError}</div>}

        {fields.length > 0 && (
          <ul className={styles.fieldList}>
            {fields.map((f, i) => (
              <li key={f.id} className={styles.fieldItem}>
                <span className={`${styles.fieldSwatch} ${styles[`swatch${i % 6}`]}`} />
                <span className={styles.fieldName}>{f.name}</span>
                <span className={styles.fieldRange}>{f.dataRange}</span>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveField(f.id)}
                >
                  刪除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.tip}>
        💡 在表格上框選會自動填入{selectionMode === 'header' ? '「標題範圍」' : '「資料範圍」'}；
        超出顯示範圍的座標可直接在輸入框修改，「A2:A」表示從 A2 到 A 欄資料底端。
        點欄字母選整欄（依各工作表實際資料列數延伸）、點列號選整列，Shift + 點擊延伸
      </div>

      <SheetTabs sheetNames={sheetNames} activeSheet={currentSheet} onSelect={handleSheetSelect} />

      <ExcelTableRenderer
        model={model}
        selectable
        onRangeSelect={handleRangeSelect}
        highlights={highlights}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} disabled={!canProceed} onClick={onNext}>
          {canProceed ? '下一步：設定目標結構 →' : '請先新增至少一個欄位'}
        </button>
      </div>
    </div>
  )
}
