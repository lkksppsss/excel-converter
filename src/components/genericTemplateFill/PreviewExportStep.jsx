import { useMemo, useState } from 'react'
import ExcelTableRenderer from '../common/ExcelTableRenderer'
import { getSheetModel, cellDisplayText } from '../../utils/genericTemplateFill/workbookReader'
import { buildCellWrites } from '../../utils/genericTemplateFill/fillEngine'
import styles from './PreviewExportStep.module.css'

const DEFAULT_PREVIEW_COUNT = 3
const MAX_PREVIEW_COUNT = 50

/**
 * 步驟 4：以前 N 筆來源資料預覽填入結果，確認後匯出。
 * 預覽不修改 workbook —— 寫入內容以 overrides 疊在 HTML table 上，
 * 匯出時才由 page 套用完整寫入並輸出檔案。
 */
export default function PreviewExportStep({
  targetWorkbook,
  targetConfig,
  sourceRows,
  mappingRules,
  isExporting,
  exportError,
  onExport,
  onBack,
}) {
  const [previewCount, setPreviewCount] = useState(DEFAULT_PREVIEW_COUNT)

  const model = useMemo(
    () => getSheetModel(targetWorkbook, targetConfig.sheetName),
    [targetWorkbook, targetConfig.sheetName]
  )

  // 開放範圍填入區（'B:B' 整欄）依目標工作表的「實際」大小解析（model 顯示用大小有上限）
  const targetBounds = useMemo(
    () => ({ rowCount: model.totalRowCount, colCount: model.totalColCount }),
    [model.totalRowCount, model.totalColCount]
  )

  const preview = useMemo(
    () =>
      buildCellWrites({
        sourceRows,
        mappingRules,
        fillZones: targetConfig.fillZones,
        targetBounds,
        limit: previewCount,
      }),
    [sourceRows, mappingRules, targetConfig.fillZones, targetBounds, previewCount]
  )

  const full = useMemo(
    () =>
      buildCellWrites({
        sourceRows,
        mappingRules,
        fillZones: targetConfig.fillZones,
        targetBounds,
      }),
    [sourceRows, mappingRules, targetConfig.fillZones, targetBounds]
  )

  const overrides = useMemo(() => {
    const map = {}
    for (const w of preview.writes) {
      map[`${w.r}:${w.c}`] = cellDisplayText(w.value)
    }
    return map
  }, [preview.writes])

  function handleCountChange(e) {
    const n = parseInt(e.target.value, 10)
    if (Number.isNaN(n)) return
    setPreviewCount(Math.max(1, Math.min(MAX_PREVIEW_COUNT, n)))
  }

  return (
    <div className={styles.step}>
      <h2 className={styles.title}>步驟 4：預覽與匯出</h2>
      <p className={styles.desc}>
        綠色格子是這次會填入的資料，其餘格子維持範本原樣。匯出時會填入全部符合條件的資料並保留範本格式
      </p>

      <div className={styles.controls}>
        <label className={styles.countLabel}>
          預覽筆數
          <input
            type="number"
            className={styles.countInput}
            min={1}
            max={MAX_PREVIEW_COUNT}
            value={previewCount}
            onChange={handleCountChange}
          />
          （最多 {MAX_PREVIEW_COUNT} 筆）
        </label>
        <div className={styles.legend}>
          <span className={styles.legendFilled} /> 本次填入
          <span className={styles.legendPlain} /> 維持原樣
        </div>
        <span className={styles.stats}>
          匯出時共會寫入 {full.writes.length} 格（來源符合條件共 {sourceRows.length} 筆）
        </span>
      </div>

      {full.overflows.length > 0 && (
        <div className={styles.warning}>
          {full.overflows.map((o) => (
            <div key={`${o.ruleId}-${o.zoneName}`}>
              ⚠ 填入區「{o.zoneName}」容量不足，有 {o.dropped} 筆資料放不下，匯出時將被略過
            </div>
          ))}
        </div>
      )}

      <ExcelTableRenderer model={model} overrides={overrides} />

      {exportError && <div className={styles.error}>{exportError}</div>}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          ← 上一步
        </button>
        <div className={styles.actionsRight}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled
            title="即將推出：儲存整組設定，下次上傳資料直接套用"
          >
            儲存為模板（即將推出）
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isExporting || full.writes.length === 0}
            onClick={onExport}
          >
            {isExporting ? '匯出中...' : '⬇ 匯出 Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
