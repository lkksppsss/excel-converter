import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import styles from './ExcelImportConfig.module.css'

// ── 自動偵測邏輯 ───────────────────────────────────────────────────────────────

function looksLikeHeader(val) {
  if (/^\d+(\.\d+)?$/.test(val)) return false
  if (/^[A-Za-z]\d{9}$/.test(val)) return false
  if (val.length > 15 && /[市縣區路街巷]/u.test(val)) return false
  return true
}

function autoDetectAllColumns(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  const defs = {}
  for (let c = range.s.c; c <= range.e.c; c++) {
    defs[c] = { header: '', headerRow: null }
    for (let r = range.s.r; r <= Math.min(range.s.r + 9, range.e.r); r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell || cell.v == null) continue
      const val = String(cell.v).trim()
      if (!val) continue
      if (looksLikeHeader(val)) {
        defs[c] = { header: val, headerRow: r }
        break
      }
    }
  }
  return defs
}

// ── 資料萃取 ───────────────────────────────────────────────────────────────────

function extractData(workbook, selectedSheets, colDefs) {
  const namedCols = Object.entries(colDefs)
    .filter(([, def]) => def.header.trim())
    .map(([colIdx, def]) => ({
      colIdx: Number(colIdx),
      header: def.header.trim(),
      headerRow: def.headerRow,
    }))

  if (namedCols.length === 0) return { headers: [], rows: [] }

  const maxHeaderRow = Math.max(...namedCols.map(d => d.headerRow ?? -1))
  const firstDataRow = maxHeaderRow + 1

  const colHeaders = namedCols.map(d => d.header)
  const headers = [...colHeaders, '來源分頁']
  const allRows = []

  for (const sheetName of selectedSheets) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')

    for (let r = firstDataRow; r <= range.e.r; r++) {
      const row = {}
      let hasValue = false
      for (const { colIdx, header } of namedCols) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: colIdx })]
        const val = cell?.v ?? null
        row[header] = val
        if (val != null && val !== '') hasValue = true
      }
      if (!hasValue) continue
      row['來源分頁'] = sheetName
      allRows.push(row)
    }
  }

  return { headers, rows: allRows }
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export default function ExcelImportConfig({ workbook, onConfirm, onCancel, initialConfig }) {
  const allSheets = workbook.SheetNames

  const [selectedSheets, setSelectedSheets] = useState(
    () => initialConfig?.selectedSheets ?? [allSheets[0]]
  )
  const [previewSheet, setPreviewSheet] = useState(
    () => initialConfig?.selectedSheets?.[0] ?? allSheets[0]
  )
  const [colDefs, setColDefs] = useState(() => initialConfig?.colDefs ?? {})
  const [previewRows, setPreviewRows] = useState([])
  const [previewCols, setPreviewCols] = useState([])

  // 只在首次 mount 時做自動偵測（有 initialConfig 則跳過）
  const didInit = useRef(false)
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      if (!initialConfig?.colDefs) {
        const ws = workbook.Sheets[workbook.SheetNames[0]]
        if (ws && ws['!ref']) setColDefs(autoDetectAllColumns(ws))
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 切換預覽分頁時只更新預覽列，不重設 colDefs
  useEffect(() => {
    const ws = workbook.Sheets[previewSheet]
    if (!ws || !ws['!ref']) {
      setPreviewCols([])
      setPreviewRows([])
      return
    }

    const range = XLSX.utils.decode_range(ws['!ref'])
    const cols = []
    for (let c = range.s.c; c <= range.e.c; c++) cols.push(c)
    setPreviewCols(cols)

    const rows = []
    for (let r = range.s.r; r <= Math.min(range.s.r + 9, range.e.r); r++) {
      const row = { _rowIdx: r }
      for (const c of cols) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        row[c] = cell?.v ?? null
      }
      rows.push(row)
    }
    setPreviewRows(rows)
  }, [previewSheet, workbook])

  function handleCellClick(rowIdx, colIdx) {
    const ws = workbook.Sheets[previewSheet]
    const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })]
    const val = cell?.v != null ? String(cell.v).trim() : ''
    if (!val) return
    setColDefs(prev => ({
      ...prev,
      [colIdx]: { header: val, headerRow: rowIdx },
    }))
  }

  function handleHeaderInput(colIdx, value) {
    setColDefs(prev => ({
      ...prev,
      [colIdx]: {
        header: value,
        headerRow: value.trim() ? (prev[colIdx]?.headerRow ?? null) : null,
      },
    }))
  }

  function clearHeader(colIdx) {
    setColDefs(prev => ({
      ...prev,
      [colIdx]: { header: '', headerRow: null },
    }))
  }

  function toggleSheet(name) {
    setSelectedSheets(prev => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev
        const next = prev.filter(s => s !== name)
        if (!next.includes(previewSheet)) setPreviewSheet(next[0])
        return next
      }
      return [...prev, name]
    })
  }

  const namedCount = Object.values(colDefs).filter(d => d.header.trim()).length
  const canConfirm = namedCount >= 1

  function handleConfirm() {
    if (!canConfirm) return
    const extracted = extractData(workbook, selectedSheets, colDefs)
    onConfirm({ ...extracted, selectedSheets, colDefs })
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>設定來源欄位</h2>
        <p className={styles.subtitle}>
          選擇要匯入的工作表，為每欄命名（點擊儲存格可自動填入）。未命名的欄位不會匯入。
          <span className={styles.sheetNote}> 資料列會自動加入「來源分頁」欄記錄工作表名稱。</span>
        </p>
      </div>

      {/* Sheet 選擇 */}
      <div className={styles.sheetSection}>
        <div className={styles.sectionLabel}>選擇工作表</div>
        <div className={styles.sheetList}>
          {allSheets.map(name => (
            <label
              key={name}
              className={`${styles.sheetItem} ${previewSheet === name ? styles.sheetItemActive : ''}`}
            >
              <input
                type="checkbox"
                className={styles.sheetCheckbox}
                checked={selectedSheets.includes(name)}
                onChange={() => toggleSheet(name)}
              />
              <span
                className={styles.sheetName}
                onClick={e => {
                  e.preventDefault()
                  if (selectedSheets.includes(name)) setPreviewSheet(name)
                }}
              >
                {name}
              </span>
              {previewSheet === name && (
                <span className={styles.previewBadge}>預覽中</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* 預覽表格 */}
      <div className={styles.tableSection}>
        <div className={styles.sectionLabel}>
          預覽前 10 列：{previewSheet}
          <span className={styles.tableTip}>點擊儲存格可設為欄位標題</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rowNumTh} />
                {previewCols.map(c => (
                  <th key={c} className={styles.colLetterTh}>
                    {XLSX.utils.encode_col(c)}
                  </th>
                ))}
              </tr>
              <tr>
                <th className={styles.rowNumTh}>標題</th>
                {previewCols.map(c => {
                  const filled = colDefs[c]?.header?.trim()
                  return (
                    <th key={c} className={styles.inputTh}>
                      <div className={styles.inputWrap}>
                        <input
                          type="text"
                          className={`${styles.headerInput} ${filled ? styles.headerInputFilled : ''}`}
                          value={colDefs[c]?.header ?? ''}
                          onChange={e => handleHeaderInput(c, e.target.value)}
                          placeholder="未命名"
                        />
                        {filled && (
                          <button
                            className={styles.clearBtn}
                            onClick={() => clearHeader(c)}
                            title="清除"
                          >×</button>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {previewRows.map(row => (
                <tr key={row._rowIdx}>
                  <td className={styles.rowNum}>{row._rowIdx + 1}</td>
                  {previewCols.map(c => {
                    const isHeaderCell = colDefs[c]?.headerRow === row._rowIdx
                    const val = row[c]
                    return (
                      <td
                        key={c}
                        className={`${styles.cell} ${isHeaderCell ? styles.cellIsHeader : ''}`}
                        onClick={() => handleCellClick(row._rowIdx, c)}
                      >
                        {val != null && val !== '' ? String(val) : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 操作列 */}
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel}>← 返回</button>
        <div className={styles.actionRight}>
          {namedCount > 0 && (
            <span className={styles.namedBadge}>已命名 {namedCount} 個欄位</span>
          )}
          <button
            className={styles.confirmBtn}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            確認欄位設定 →
          </button>
        </div>
      </div>
    </div>
  )
}
