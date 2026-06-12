import { useMemo, useState } from 'react'
import FileDropZone from '../common/FileDropZone'
import ExcelTableRenderer from '../common/ExcelTableRenderer'
import { zoneHighlightType } from '../common/excelTableHighlight'
import SheetTabs from './SheetTabs'
import { readWorkbookFromFile, getSheetNames, getSheetModel } from '../../utils/genericTemplateFill/workbookReader'
import { buildFieldDefs, validateRangeInput } from '../../utils/genericTemplateFill/sourceTable'
import styles from './TargetStructureStep.module.css'

let zoneIdCounter = 0
function nextZoneId() {
  zoneIdCounter += 1
  return `zone-${zoneIdCounter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 步驟 2：上傳目標範本，定義「填入區」——
 * 框選範本上的標題格可自動帶出名稱（可修改），多欄標題會自動逐欄拆成多個填入區。
 * 範圍可手動輸入（例：B4:B500、B4:B），不受表格顯示列數限制。
 *
 * targetConfig 形狀：{ fileName, sheetName, fillZones: [{ id, name, range }] }
 */
export default function TargetStructureStep({
  workbook,
  config,
  onWorkbookReady,
  onConfigChange,
  onNext,
  onBack,
}) {
  const [file, setFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectionMode, setSelectionMode] = useState('header') // 'header' | 'fill'
  const [pendingHeader, setPendingHeader] = useState('')
  const [pendingFill, setPendingFill] = useState('')
  const [zoneName, setZoneName] = useState('')
  const [formError, setFormError] = useState('')

  const sheetNames = useMemo(() => (workbook ? getSheetNames(workbook) : []), [workbook])
  const zones = config?.fillZones || []
  const currentSheet = sheetNames.includes(config?.sheetName) ? config.sheetName : sheetNames[0] || ''
  const fileName = file?.name || config?.fileName || ''
  const isLegacyXls = fileName.toLowerCase().endsWith('.xls')

  const model = useMemo(
    () => (workbook && currentSheet ? getSheetModel(workbook, currentSheet) : null),
    [workbook, currentSheet]
  )

  async function handleFile(selected) {
    setFile(selected)
    setError('')
    setIsLoading(true)
    try {
      const wb = await readWorkbookFromFile(selected)
      onWorkbookReady(wb, selected.name)
      const names = getSheetNames(wb)
      if (config && !names.includes(config.sheetName)) {
        onConfigChange(null)
      } else if (config) {
        onConfigChange({ ...config, fileName: selected.name })
      }
      setPendingHeader('')
      setPendingFill('')
      setZoneName('')
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSheetSelect(name) {
    if (name === currentSheet) return
    if (zones.length > 0 && !window.confirm('切換工作表會清除已設定的填入區，確定切換？')) {
      return
    }
    setPendingHeader('')
    setPendingFill('')
    setZoneName('')
    onConfigChange({ fileName: file?.name || config?.fileName, sheetName: name, fillZones: [] })
  }

  function handleRangeSelect(rangeA1) {
    setFormError('')
    if (selectionMode === 'header') {
      setPendingHeader(rangeA1)
      // 從範本的標題格自動帶出名稱（單欄才帶，多欄會逐欄自動命名）
      try {
        const defs = buildFieldDefs(workbook, currentSheet, rangeA1, rangeA1)
        setZoneName(defs.length === 1 ? defs[0].name : '')
      } catch {
        setZoneName('')
      }
      setSelectionMode('fill')
    } else {
      setPendingFill(rangeA1)
    }
  }

  function dedupeName(name, usedNames) {
    let result = name
    let n = 2
    while (usedNames.has(result)) result = `${name} (${n++})`
    usedNames.add(result)
    return result
  }

  function handleAddZone() {
    const fillError = validateRangeInput(pendingFill)
    if (fillError) {
      setFormError(`填入範圍：${fillError}`)
      return
    }

    const usedNames = new Set(zones.map((z) => z.name))
    let newZones
    if (pendingHeader.trim()) {
      if (validateRangeInput(pendingHeader)) {
        setFormError(`標題範圍：${validateRangeInput(pendingHeader)}`)
        return
      }
      let defs
      try {
        defs = buildFieldDefs(workbook, currentSheet, pendingHeader.trim(), pendingFill.trim())
      } catch {
        setFormError('無法解析範圍，請確認格式（例：B3、B3:D3、B4:B500、B4:B）')
        return
      }
      if (defs.length === 0) {
        setFormError('這個標題範圍內沒有可用的欄位')
        return
      }
      // 單一填入區時，手動輸入的名稱優先於範本標題
      if (defs.length === 1 && zoneName.trim()) defs[0].name = zoneName.trim()
      newZones = defs.map((def) => ({
        id: nextZoneId(),
        name: dedupeName(def.name, usedNames),
        range: def.dataRange,
      }))
    } else {
      const name = zoneName.trim()
      if (!name) {
        setFormError('沒有框選標題時，請輸入填入區名稱')
        return
      }
      if (usedNames.has(name)) {
        setFormError('名稱已存在，請換一個')
        return
      }
      newZones = [{ id: nextZoneId(), name, range: pendingFill.trim() }]
    }

    onConfigChange({
      fileName: file?.name || config?.fileName,
      sheetName: currentSheet,
      fillZones: [...zones, ...newZones],
    })
    setPendingHeader('')
    setPendingFill('')
    setZoneName('')
    setSelectionMode('header')
    setFormError('')
  }

  function handleRemoveZone(id) {
    onConfigChange({ ...config, fillZones: zones.filter((z) => z.id !== id) })
  }

  const highlights = zones.map((z, i) => ({ range: z.range, type: zoneHighlightType(i) }))
  if (pendingHeader && !validateRangeInput(pendingHeader)) {
    highlights.push({ range: pendingHeader, type: 'header' })
  }
  if (pendingFill && !validateRangeInput(pendingFill)) {
    highlights.push({ range: pendingFill, type: zoneHighlightType(zones.length) })
  }

  const canProceed = Boolean(workbook && zones.length > 0)

  if (!workbook) {
    return (
      <div className={styles.step}>
        <h2 className={styles.title}>步驟 2：設定目標結構</h2>
        <p className={styles.desc}>上傳固定格式的目標範本，輸出時會完整保留範本的樣式與公式（.xlsx）</p>
        {zones.length > 0 && (
          <div className={styles.restoreNotice}>
            已保留先前設定的 {zones.length} 個填入區（{config.fileName}），重新上傳同一個檔案即可繼續
          </div>
        )}
        <div className={styles.dropWrapper}>
          <FileDropZone
            label="目標範本檔案"
            hint="拖曳或點擊上傳 .xlsx / .xls"
            accept=".xlsx,.xls"
            file={file}
            error={error}
            isLoading={isLoading}
            onFile={handleFile}
          />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={onBack}>
            ← 上一步
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.step}>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>步驟 2：設定目標結構</h2>
          <p className={styles.desc}>
            框選範本上的「標題」自動帶出名稱，再框選或輸入「填入範圍」（例：B4:B500、B4:B 到底）。
            多欄標題會自動逐欄拆成多個填入區
          </p>
        </div>
        <button type="button" className={styles.linkButton} onClick={() => onWorkbookReady(null, null)}>
          重新選擇檔案
        </button>
      </div>

      {isLegacyXls && (
        <div className={styles.restoreNotice}>
          ⚠ .xls 是舊版格式，無法保留範本樣式（顏色、框線等）。建議先用 Excel 另存為 .xlsx 再上傳
        </div>
      )}

      <div className={styles.zonePanel}>
        <div className={styles.addZoneRow}>
          <label
            className={`${styles.rangeGroup} ${selectionMode === 'header' ? styles.rangeGroupActive : ''}`}
          >
            <span className={styles.rangeLabel}>標題範圍（選填，自動命名）</span>
            <input
              type="text"
              className={styles.rangeInput}
              placeholder="例：B3 或 B3:D3"
              value={pendingHeader}
              onFocus={() => setSelectionMode('header')}
              onChange={(e) => {
                setPendingHeader(e.target.value)
                setFormError('')
              }}
            />
          </label>

          <label
            className={`${styles.rangeGroup} ${selectionMode === 'fill' ? styles.rangeGroupActive : ''}`}
          >
            <span className={styles.rangeLabel}>填入範圍</span>
            <input
              type="text"
              className={styles.rangeInput}
              placeholder="例：B4:B500 或 B4:B"
              value={pendingFill}
              onFocus={() => setSelectionMode('fill')}
              onChange={(e) => {
                setPendingFill(e.target.value)
                setFormError('')
              }}
            />
          </label>

          <label className={styles.rangeGroup}>
            <span className={styles.rangeLabel}>名稱</span>
            <input
              type="text"
              className={styles.nameInput}
              placeholder={pendingHeader ? '已從標題帶入，可修改' : '例如：1月薪資'}
              value={zoneName}
              onChange={(e) => {
                setZoneName(e.target.value)
                setFormError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddZone()
              }}
            />
          </label>

          <button
            type="button"
            className={styles.addButton}
            disabled={!pendingFill}
            onClick={handleAddZone}
          >
            ＋ 新增填入區
          </button>
        </div>
        {formError && <div className={styles.nameError}>{formError}</div>}

        {zones.length > 0 && (
          <ul className={styles.zoneList}>
            {zones.map((z, i) => (
              <li key={z.id} className={styles.zoneItem}>
                <span className={`${styles.zoneSwatch} ${styles[`swatch${i % 6}`]}`} />
                <span className={styles.zoneName}>{z.name}</span>
                <span className={styles.zoneRange}>{z.range}</span>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveZone(z.id)}
                >
                  刪除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.tip}>
        💡 在表格上框選會自動填入{selectionMode === 'header' ? '「標題範圍」' : '「填入範圍」'}；
        超出顯示範圍的座標可直接在輸入框修改，「B4:B」表示從 B4 到 B 欄資料底端。
        點欄字母選整欄、點列號選整列，Shift + 點擊延伸
      </div>

      <SheetTabs sheetNames={sheetNames} activeSheet={currentSheet} onSelect={handleSheetSelect} />

      <ExcelTableRenderer
        model={model}
        selectable
        onRangeSelect={handleRangeSelect}
        highlights={highlights}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          ← 上一步
        </button>
        <button type="button" className={styles.primaryButton} disabled={!canProceed} onClick={onNext}>
          {canProceed ? '下一步：設定對應規則 →' : '請先新增至少一個填入區'}
        </button>
      </div>
    </div>
  )
}
