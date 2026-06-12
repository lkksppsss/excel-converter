// 填入引擎：把對應規則套用到來源資料列，算出要寫入目標範本的儲存格清單。
// 預覽與匯出共用 buildCellWrites 的結果，確保「所見即所得」。
//
// mappingRule 形狀：
// {
//   id: string,
//   sourceField: string,        // 來源欄位名稱
//   targetZoneId: string,       // 對應 targetConfig.fillZones[].id
//   condition: null
//     | { type: 'column-value', column: string, value: string }   // A：欄位等值
//     | { type: 'sheet-name', sheetName: string },                // C：來源 sheet 名稱
// }
//
// fillZone 形狀：{ id: string, name: string, range: 'B4:B15' }

import { parseRangeSpec, resolveRangeSpec, cellsInRange } from './rangeUtils.js'

export function describeCondition(condition) {
  if (!condition) return '全部資料'
  if (condition.type === 'column-value') return `「${condition.column}」= ${condition.value}`
  if (condition.type === 'sheet-name') return `工作表「${condition.sheetName}」`
  return '未知條件'
}

export function filterRowsByCondition(rows, condition) {
  if (!condition) return rows
  if (condition.type === 'column-value') {
    return rows.filter(
      (row) => String(row.values[condition.column] ?? '').trim() === String(condition.value).trim()
    )
  }
  if (condition.type === 'sheet-name') {
    return rows.filter((row) => row.sheetName === condition.sheetName)
  }
  return rows
}

/**
 * 計算所有規則產生的儲存格寫入。
 * 同一條規則的第 i 筆資料寫入填入區 row-major 順序的第 i 格，
 * 空值會佔住格位但不寫入（維持各填入區之間的列對齊，也維持非破壞性）。
 *
 * @param {object} params
 * @param {Array}  params.sourceRows    extractSourceRows 的結果
 * @param {Array}  params.mappingRules
 * @param {Array}  params.fillZones
 * @param {object} params.targetBounds  目標工作表大小 {rowCount, colCount}，
 *                                      供開放範圍填入區（'B:B' 整欄）解析用
 * @param {number} [params.limit]       只取每條規則篩選後的前 N 筆（預覽用）
 * @returns {{ writes: Array<{r,c,value,zoneId,ruleId}>, overflows: Array<{ruleId,zoneName,dropped}> }}
 */
export function buildCellWrites({ sourceRows, mappingRules, fillZones, targetBounds, limit }) {
  const bounds = targetBounds || { rowCount: 0, colCount: 0 }
  const zoneById = new Map(fillZones.map((z) => [z.id, z]))
  const writes = []
  const overflows = []

  for (const rule of mappingRules) {
    const zone = zoneById.get(rule.targetZoneId)
    if (!zone) continue

    let rows = filterRowsByCondition(sourceRows, rule.condition)
    if (limit != null) rows = rows.slice(0, limit)

    const cells = cellsInRange(resolveRangeSpec(parseRangeSpec(zone.range), bounds))
    const count = Math.min(rows.length, cells.length)
    for (let i = 0; i < count; i++) {
      const value = rows[i].values[rule.sourceField]
      if (value == null || String(value).trim() === '') continue
      writes.push({ r: cells[i].r, c: cells[i].c, value, zoneId: zone.id, ruleId: rule.id })
    }
    if (rows.length > cells.length) {
      overflows.push({ ruleId: rule.id, zoneName: zone.name, dropped: rows.length - cells.length })
    }
  }

  return { writes, overflows }
}

// 與舊版 templateFiller 一致：數字字串轉成數字，讓 Excel 能正確計算
function coerceValue(value) {
  if (typeof value === 'number' || value instanceof Date) return value
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
    return Number(value)
  }
  return value
}

// 只改 cell.value，不動樣式 —— ExcelJS 會保留範本的原始格式
export function applyWritesToWorksheet(worksheet, writes) {
  for (const w of writes) {
    worksheet.getCell(w.r + 1, w.c + 1).value = coerceValue(w.value)
  }
}

export async function workbookToXlsxBlob(workbook) {
  const buf = await workbook.xlsx.writeBuffer()
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
