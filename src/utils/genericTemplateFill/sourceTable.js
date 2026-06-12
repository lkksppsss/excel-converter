// 來源結構 = 欄位定義清單：每個欄位有自己的名稱（取自標題格）與資料範圍。
//
// sourceConfig 形狀（存於 sessionStorage，全部可序列化）：
// {
//   fileName: string,
//   sheetName: string,            // 標記範圍所在的工作表
//   applyToAllSheets: boolean,    // 相同結構套用到所有工作表（供 sheet 名稱條件使用）
//   fields: [
//     { id, name: '姓名', headerRange: 'A1', dataRange: 'A2:A500' },
//     { id, name: '底薪', headerRange: 'B1', dataRange: 'B:B' },   // 開放範圍：依各工作表實際列數延伸
//   ],
// }
//
// 資料列的組成：各欄位的資料範圍依「序位」對齊 —— 每個欄位的第 i 格組成第 i 列。
// 範圍字串可手動輸入（不受表格顯示列數上限影響），框選只是輔助輸入。

import {
  parseRangeSpec,
  resolveRangeSpec,
  encodeRange,
  encodeRangeSpec,
  colIndexToLetter,
  cellsInRange,
} from './rangeUtils.js'
import { cellRawValue } from './workbookReader.js'

export function getFieldDefs(config) {
  return Array.isArray(config?.fields) ? config.fields : []
}

function sheetBounds(ws) {
  return { rowCount: ws.rowCount || 0, colCount: ws.columnCount || 0 }
}

/**
 * 把「標題範圍 + 資料範圍」配對成欄位定義（不含 id，由呼叫端補上）。
 *
 * - 標題每一欄產生一個欄位，名稱取該欄標題文字（多列由上而下串接，空白則自動命名）
 * - 資料範圍只取「列範圍」與「欄對應」：
 *     資料欄數 = 標題欄數 → 逐欄配對（支援標題與資料不同欄的位移版面）
 *     否則 → 沿用標題的欄，套用資料範圍的列
 * - 資料列開放（'A:A' 或列數未指定）時，輸出開放範圍字串，解析時依各工作表實際列數延伸
 * - 整列標題（'1:1'）會略過沒有文字的欄
 *
 * @returns {Array<{name, headerRange, dataRange}>}
 */
export function buildFieldDefs(workbook, sheetName, headerRangeStr, dataRangeStr) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) return []
  const bounds = sheetBounds(ws)

  const headerSpec = parseRangeSpec(headerRangeStr)
  const header = resolveRangeSpec(headerSpec, bounds)
  const hasOpenHeaderCols = headerSpec.s.c === null

  const dataSpec = parseRangeSpec(dataRangeStr)
  const headerColCount = header.e.c - header.s.c + 1
  const dataColCount = dataSpec.s.c === null ? null : dataSpec.e.c - dataSpec.s.c + 1
  const pairByPosition = dataColCount === headerColCount

  const defs = []
  for (let i = 0; i < headerColCount; i++) {
    const c = header.s.c + i
    const parts = []
    for (let r = header.s.r; r <= header.e.r; r++) {
      const v = cellRawValue(ws.getRow(r + 1).getCell(c + 1).value)
      const text = v == null ? '' : String(v).trim()
      if (text !== '' && !parts.includes(text)) parts.push(text)
    }
    if (hasOpenHeaderCols && parts.length === 0) continue

    const dataCol = pairByPosition ? dataSpec.s.c + i : c
    // encodeRangeSpec 統一處理三種列範圍：固定（A2:A500）、半開放（A3:A）、整欄（A:A）
    const dataRange = encodeRangeSpec({
      s: { r: dataSpec.s.r, c: dataCol },
      e: { r: dataSpec.e.r, c: dataCol },
    })

    defs.push({
      name: parts.join(' ') || `欄位${colIndexToLetter(c)}`,
      headerRange: encodeRange({
        s: { r: header.s.r, c },
        e: { r: header.e.r, c },
      }),
      dataRange,
    })
  }
  return defs
}

// 單一欄位在指定工作表上的資料值（依範圍內 row-major 順序）
function readFieldValues(ws, bounds, field) {
  const spec = parseRangeSpec(field.dataRange)
  const resolved = resolveRangeSpec(spec, bounds)

  // 開放列範圍（'A:A'）會涵蓋標題本身，依該欄位的標題範圍排除
  const excludedRows = new Set()
  if (spec.s.r === null && field.headerRange) {
    const h = resolveRangeSpec(parseRangeSpec(field.headerRange), bounds)
    for (let r = h.s.r; r <= h.e.r; r++) excludedRows.add(r)
  }

  const values = []
  for (const cell of cellsInRange(resolved)) {
    if (excludedRows.has(cell.r)) continue
    values.push(cellRawValue(ws.getRow(cell.r + 1).getCell(cell.c + 1).value))
  }
  return values
}

/**
 * 抽出資料列。每列為 { sheetName, values: { 欄位名: 值 } }。
 * - 各欄位依序位對齊：每個欄位的第 i 格組成第 i 列，缺值為 null
 * - 「所有欄位都空白」的序位整列略過（保持各欄位間的對齊）
 * - applyToAllSheets 為 true 時，以相同的欄位定義讀取每個工作表
 */
export function extractSourceRows(workbook, sourceConfig) {
  const fields = getFieldDefs(sourceConfig)
  if (fields.length === 0) return []
  const sheetNames = sourceConfig.applyToAllSheets
    ? workbook.worksheets.map((ws) => ws.name)
    : [sourceConfig.sheetName]

  const rows = []
  for (const sheetName of sheetNames) {
    const ws = workbook.getWorksheet(sheetName)
    if (!ws) continue
    const bounds = sheetBounds(ws)
    const columns = fields.map((field) => readFieldValues(ws, bounds, field))
    const maxLen = Math.max(0, ...columns.map((values) => values.length))

    for (let i = 0; i < maxLen; i++) {
      const values = {}
      let hasValue = false
      fields.forEach((field, fi) => {
        const v = columns[fi][i] ?? null
        values[field.name] = v
        if (v != null && String(v).trim() !== '') hasValue = true
      })
      if (hasValue) rows.push({ sheetName, values })
    }
  }
  return rows
}

// 提供給「儲存格座標輸入框」的驗證：回傳錯誤訊息，合法則回傳 null
export function validateRangeInput(str) {
  if (!str || !String(str).trim()) return '請輸入範圍'
  try {
    parseRangeSpec(str)
    return null
  } catch {
    return `無效的範圍：${str}（例：A2:A500、A2:A、A:A、2:50）`
  }
}
