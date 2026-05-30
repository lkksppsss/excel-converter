import { useMemo } from 'react'
import * as XLSX from 'xlsx'
import styles from './MappingPreview.module.css'

const PREVIEW_EMPLOYEE_SLOTS = 3

export default function MappingPreview({
  templateWorkbook,
  templateStructure,
  sourceRows,
  identityMapping,
  salaryMapping,
  selectedMonths,
  monthSourceColumn,
  monthValueMapping,
}) {
  const { grid, mergeMap, overrideMap } = useMemo(() => {
    if (!templateWorkbook || !templateStructure) {
      return { grid: [], mergeMap: new Map(), overrideMap: new Map() }
    }

    const sheetName = templateWorkbook.SheetNames[0]
    const ws = templateWorkbook.Sheets[sheetName]
    if (!ws) return { grid: [], mergeMap: new Map(), overrideMap: new Map() }

    const {
      firstEmployeeRowIndex,
      groupSize,
      identityColumns,
      salaryItemOffsets,
      monthColumnIndices,
    } = templateStructure

    const previewRowCount = firstEmployeeRowIndex + PREVIEW_EMPLOYEE_SLOTS * groupSize
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 0 })
    const grid = raw.slice(0, previewRowCount)

    // 確保每列都有足夠的欄位
    const maxCols = grid.reduce((m, row) => Math.max(m, row.length), 0)
    for (const row of grid) {
      while (row.length < maxCols) row.push('')
    }

    // 建立合併儲存格查找表
    // key: "r,c" → { rowspan, colspan } (master cell)
    // key: "r,c" → null (slave cell, 需跳過)
    const mergeMap = new Map()
    const merges = ws['!merges'] || []
    for (const merge of merges) {
      const { s, e } = merge
      if (s.r >= previewRowCount) continue
      const rowspan = Math.min(e.r, previewRowCount - 1) - s.r + 1
      const colspan = e.c - s.c + 1
      mergeMap.set(`${s.r},${s.c}`, { rowspan, colspan })
      for (let r = s.r; r <= Math.min(e.r, previewRowCount - 1); r++) {
        for (let c = s.c; c <= e.c; c++) {
          if (r === s.r && c === s.c) continue
          mergeMap.set(`${r},${c}`, null)
        }
      }
    }

    // 建立 override 值對應表：key "r,c" → { value, isMapped }
    const overrideMap = new Map()

    const idCol = identityMapping['身分證號']

    if (idCol) {
      // ── 多月份模式：依身分證號分組，再按月份找對應列 ──────────────────────

      // 步驟 1：依身分證號欄的值把 sourceRows 分組
      const groups = new Map()
      for (const row of sourceRows) {
        const id = String(row[idCol] ?? '').trim()
        if (!id) continue
        if (!groups.has(id)) groups.set(id, [])
        groups.get(id).push(row)
      }
      const employeeIds = [...groups.keys()].slice(0, PREVIEW_EMPLOYEE_SLOTS)

      for (let slotIdx = 0; slotIdx < employeeIds.length; slotIdx++) {
        const empId = employeeIds[slotIdx]
        const empRows = groups.get(empId)
        const firstRow = empRows[0]
        const baseRow = firstEmployeeRowIndex + slotIdx * groupSize

        // 步驟 2：填身份欄位（各月相同，取第一筆）
        for (const [templateField, colIdx] of Object.entries(identityColumns)) {
          const srcHeader = identityMapping[templateField]
          if (!srcHeader) continue
          const value = firstRow[srcHeader] ?? ''
          overrideMap.set(`${baseRow},${colIdx}`, { value, isMapped: true })
        }

        // 步驟 3：填薪資項目（依月份找對應列）
        for (const monthName of selectedMonths) {
          // 從 monthValueMapping（source值 → 模板月份）反查：找哪個來源值對應此模板月份
          const monthLabel = Object.entries(monthValueMapping ?? {})
            .find(([, v]) => v === monthName)?.[0]

          const monthRow = empRows.find((row) => {
            if (!monthSourceColumn || !monthLabel) return false
            const rawMonth = String(row[monthSourceColumn] ?? '').trim()
            return rawMonth === monthLabel
          })
          if (!monthRow) continue

          const colIdx = monthColumnIndices[monthName]
          if (colIdx == null) continue

          for (const [field, offset] of Object.entries(salaryItemOffsets)) {
            const srcHeader = salaryMapping[field]
            if (!srcHeader) continue
            const value = monthRow[srcHeader] ?? ''
            const itemRow = baseRow + offset
            overrideMap.set(`${itemRow},${colIdx}`, { value, isMapped: true })
          }
        }
      }
    } else {
      // ── fallback：身分證號未設定，保留原本行為（直接用 sourceRows[slotIdx]）──

      for (let slotIdx = 0; slotIdx < PREVIEW_EMPLOYEE_SLOTS; slotIdx++) {
        const srcRow = sourceRows[slotIdx]
        if (!srcRow) continue

        const baseRow = firstEmployeeRowIndex + slotIdx * groupSize

        // 身份欄位
        for (const [templateField, colIdx] of Object.entries(identityColumns)) {
          const srcHeader = identityMapping[templateField]
          if (!srcHeader) continue
          const value = srcRow[srcHeader] ?? ''
          overrideMap.set(`${baseRow},${colIdx}`, { value, isMapped: true })
        }

        // 薪資項目（每個選定月份）
        for (const [field, offset] of Object.entries(salaryItemOffsets)) {
          const srcHeader = salaryMapping[field]
          if (!srcHeader) continue
          const value = srcRow[srcHeader] ?? ''
          const itemRow = baseRow + offset

          for (const monthName of selectedMonths) {
            const colIdx = monthColumnIndices[monthName]
            if (colIdx == null) continue
            overrideMap.set(`${itemRow},${colIdx}`, { value, isMapped: true })
          }
        }
      }
    }

    return { grid, mergeMap, overrideMap }
  }, [templateWorkbook, templateStructure, sourceRows, identityMapping, salaryMapping, selectedMonths, monthSourceColumn, monthValueMapping])

  if (!templateWorkbook || !templateStructure) {
    return (
      <div className={styles.empty}>
        <p>載入模板後顯示即時預覽</p>
      </div>
    )
  }

  if (grid.length === 0) {
    return (
      <div className={styles.empty}>
        <p>無法讀取模板資料</p>
      </div>
    )
  }

  const { headerRowIndex } = templateStructure

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleBar}>
        <span className={styles.titleText}>即時預覽</span>
        <span className={styles.subtitle}>顯示前 {PREVIEW_EMPLOYEE_SLOTS} 位員工資料</span>
      </div>
      <div className={styles.scrollArea}>
        <table className={styles.table}>
          <tbody>
            {grid.map((row, rIdx) => {
              const isHeaderRow = rIdx === headerRowIndex
              return (
                <tr key={rIdx} className={isHeaderRow ? styles.headerRow : ''}>
                  {row.map((cellVal, cIdx) => {
                    const key = `${rIdx},${cIdx}`
                    const mergeInfo = mergeMap.get(key)

                    // slave cell → 跳過
                    if (mergeInfo === null) return null

                    const override = overrideMap.get(key)
                    const displayValue = override ? override.value : cellVal

                    let cellClass = styles.cell
                    if (isHeaderRow) {
                      cellClass = styles.cellHeader
                    } else if (override?.isMapped) {
                      cellClass = styles.cellMapped
                    } else if (cellVal === '' && !isHeaderRow) {
                      cellClass = styles.cellEmpty
                    }

                    const tdProps = {}
                    if (mergeInfo) {
                      if (mergeInfo.colspan > 1) tdProps.colSpan = mergeInfo.colspan
                      if (mergeInfo.rowspan > 1) tdProps.rowSpan = mergeInfo.rowspan
                    }

                    return (
                      <td key={cIdx} className={cellClass} {...tdProps}>
                        {displayValue}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendMapped}>已對應</span>
        <span className={styles.legendEmpty}>未對應</span>
        <span className={styles.legendOriginal}>原始內容</span>
      </div>
    </div>
  )
}
