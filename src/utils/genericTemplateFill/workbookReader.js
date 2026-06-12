// 以 ExcelJS 讀取 workbook 與產生「可渲染的 sheet model」。
// 範本填入功能一律使用 ExcelJS（而非 SheetJS），因為輸出時要保留範本的原始樣式：
// ExcelJS 載入 → 只改 cell.value → writeBuffer，樣式、公式、合併儲存格都會保留。
//
// .xls（舊版 BIFF）與 .csv 是 ExcelJS 讀不了的格式，改用 SheetJS 解析後
// 轉成 ExcelJS workbook —— 只搬「值 + 合併儲存格」，樣式不保留
// （來源檔只讀值所以無差；目標範本請用 .xlsx 才能保留樣式）。

import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import { parseRange } from './rangeUtils.js'

function convertSheetJSWorkbook(sheetJSWb) {
  const wb = new ExcelJS.Workbook()
  for (const sheetName of sheetJSWb.SheetNames) {
    const sjsWs = sheetJSWb.Sheets[sheetName]
    const ws = wb.addWorksheet(sheetName)
    if (!sjsWs['!ref']) continue
    const range = XLSX.utils.decode_range(sjsWs['!ref'])
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sjsWs[XLSX.utils.encode_cell({ r, c })]
        if (!cell || cell.v === undefined || cell.t === 'e') continue
        ws.getCell(r + 1, c + 1).value = cell.v
      }
    }
    for (const merge of sjsWs['!merges'] || []) {
      ws.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1)
    }
  }
  return wb
}

export async function readWorkbookFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const buf = await file.arrayBuffer()

  let wb
  try {
    if (ext === 'csv') {
      const text = new TextDecoder('utf-8').decode(buf)
      wb = convertSheetJSWorkbook(XLSX.read(text, { type: 'string' }))
    } else if (ext === 'xls') {
      wb = convertSheetJSWorkbook(XLSX.read(buf, { type: 'array', cellDates: true }))
    } else {
      wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)
    }
  } catch {
    throw new Error('無法解析此檔案，請確認是有效的 Excel 檔案（.xlsx / .xls / .csv）')
  }
  if (wb.worksheets.length === 0) {
    throw new Error('檔案中沒有任何工作表')
  }
  return wb
}

export function getSheetNames(workbook) {
  return workbook.worksheets.map((ws) => ws.name)
}

// 工作表實際大小（供開放範圍 'A:F' / '2:5' 解析用）
export function getSheetBounds(workbook, sheetName) {
  const ws = workbook.getWorksheet(sheetName)
  return { rowCount: ws?.rowCount || 0, colCount: ws?.columnCount || 0 }
}

// ExcelJS 的 cell.value 可能是多種型別，取出「實際資料值」（公式取計算結果）
export function cellRawValue(value) {
  if (value == null) return null
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('')
    if ('formula' in value || 'sharedFormula' in value) return cellRawValue(value.result)
    if ('hyperlink' in value) return cellRawValue(value.text)
    if ('error' in value) return null
    return String(value)
  }
  return value
}

// 取出「顯示用文字」
export function cellDisplayText(value) {
  const raw = cellRawValue(value)
  if (raw == null) return ''
  if (raw instanceof Date) {
    return `${raw.getFullYear()}/${raw.getMonth() + 1}/${raw.getDate()}`
  }
  return String(raw)
}

/**
 * 把指定工作表轉成可供 HTML table 渲染的純資料 model。
 *
 * @returns {{
 *   sheetName: string,
 *   rowCount: number, colCount: number,
 *   cells: string[][],                       // cells[r][c] = 顯示文字
 *   merges: Array<{s:{r,c}, e:{r,c}}>,       // 已裁切到 model 範圍內
 *   isTruncated: boolean,
 * }}
 */
export function getSheetModel(workbook, sheetName, { maxRows = 100, maxCols = 40 } = {}) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) {
    return { sheetName, rowCount: 0, colCount: 0, cells: [], merges: [], isTruncated: false }
  }

  const totalRows = ws.rowCount || 0
  const totalCols = ws.columnCount || 0
  const rowCount = Math.min(totalRows, maxRows)
  const colCount = Math.min(totalCols, maxCols)

  const cells = []
  for (let r = 0; r < rowCount; r++) {
    const row = ws.getRow(r + 1)
    const cellRow = []
    for (let c = 0; c < colCount; c++) {
      cellRow.push(cellDisplayText(row.getCell(c + 1).value))
    }
    cells.push(cellRow)
  }

  const merges = (ws.model?.merges || [])
    .map((m) => parseRange(m))
    .filter((m) => m.s.r < rowCount && m.s.c < colCount)
    .map((m) => ({
      s: m.s,
      e: { r: Math.min(m.e.r, rowCount - 1), c: Math.min(m.e.c, colCount - 1) },
    }))

  return {
    sheetName,
    rowCount,
    colCount,
    totalRowCount: totalRows,
    totalColCount: totalCols,
    cells,
    merges,
    isTruncated: totalRows > rowCount || totalCols > colCount,
  }
}
