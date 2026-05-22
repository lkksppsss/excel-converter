import * as XLSX from 'xlsx'

/**
 * 把來源 flat table 填入薪資印領清冊範本。
 *
 * @param {import('xlsx').WorkBook} workbook   - 已用 XLSX.read() 讀入的範本 workbook
 * @param {object[]} sourceRows                - 來源資料列，每個 object 的 key = 欄位名稱
 * @param {MappingConfig} mappingConfig        - UI 傳入的對應設定（格式見下方 JSDoc）
 * @param {object} structure                   - SALARY_PAYROLL_STRUCTURE
 * @returns {import('xlsx').WorkBook}          - 修改後的 workbook（可直接 XLSX.write() 輸出）
 *
 * @typedef {Object} MappingConfig
 * @property {Record<string, string>} identityMapping   - template 身份欄位 → 來源欄位名稱
 * @property {Record<string, string|null>} salaryMapping - template 薪資項目 → 來源欄位名稱（null 表示不填）
 * @property {string} monthSourceColumn                  - 來源 Excel 中哪欄是月份
 * @property {Record<string, string>} monthValueMapping  - 來源月份值 → template 月份欄名稱
 * @property {string[]} selectedMonths                   - 這次只填哪幾個月
 */
export function fillTemplate(workbook, sourceRows, mappingConfig, structure) {
  if (!workbook || !sourceRows || !mappingConfig || !structure) {
    throw new Error('fillTemplate: 缺少必要參數')
  }

  const {
    identityMapping,
    salaryMapping,
    monthSourceColumn,
    monthValueMapping,
    selectedMonths,
  } = mappingConfig

  const {
    firstEmployeeRowIndex,
    groupSize,
    maxEmployees,
    identityColumns,
    salaryItemColumn: _salaryItemColumn,
    salaryItemOffsets,
    monthColumnIndices,
  } = structure

  // 取第一個 sheet（範本只有一個工作表）
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]

  // ------------------------------------------------------------------
  // 步驟 1：把 sourceRows 依「身分證號」來源欄分組
  //   groups: Map<身分證號字串, object[]>
  // ------------------------------------------------------------------
  const idSourceCol = identityMapping['身分證號']
  if (!idSourceCol) {
    throw new Error('fillTemplate: identityMapping 必須包含「身分證號」的來源欄對應')
  }

  /** @type {Map<string, object[]>} */
  const groups = new Map()
  for (const row of sourceRows) {
    const idValue = row[idSourceCol]
    if (idValue == null) continue
    const idKey = String(idValue).trim()
    if (!groups.has(idKey)) groups.set(idKey, [])
    groups.get(idKey).push(row)
  }

  // 員工清單（依 sourceRows 出現順序排列，去重）
  const employeeIds = [...groups.keys()]

  // ------------------------------------------------------------------
  // 步驟 2：決定每個員工對應哪個範本 slot
  //   優先用身分證號比對現有 slot，找不到就按順序分配空白 slot
  // ------------------------------------------------------------------

  /**
   * 讀取範本 slot 中已有的身分證號值
   * @param {number} slotIdx
   * @returns {string}
   */
  function getExistingSlotId(slotIdx) {
    const idColIdx = identityColumns['身分證號']
    const rowIdx = firstEmployeeRowIndex + slotIdx * groupSize // offset 0
    const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: idColIdx })
    const cell = ws[cellAddr]
    return cell && cell.v != null ? String(cell.v).trim() : ''
  }

  // 先掃描範本中既有的 slot → 身分證號 mapping
  const existingSlotMap = new Map() // 身分證號 → slotIdx
  for (let slotIdx = 0; slotIdx < maxEmployees; slotIdx++) {
    const existingId = getExistingSlotId(slotIdx)
    if (existingId) existingSlotMap.set(existingId, slotIdx)
  }

  // 找出空白 slot（範本中沒有身分證號的 slot）
  const occupiedSlots = new Set(existingSlotMap.values())
  const blankSlots = []
  for (let slotIdx = 0; slotIdx < maxEmployees; slotIdx++) {
    if (!occupiedSlots.has(slotIdx)) blankSlots.push(slotIdx)
  }

  /** @type {Map<string, number>} 身分證號 → slotIdx */
  const employeeSlotMap = new Map()
  let blankSlotPointer = 0

  for (const empId of employeeIds) {
    if (existingSlotMap.has(empId)) {
      // 範本已有此人，用比對到的 slot
      employeeSlotMap.set(empId, existingSlotMap.get(empId))
    } else if (blankSlotPointer < blankSlots.length) {
      // 新員工，分配下一個空白 slot
      employeeSlotMap.set(empId, blankSlots[blankSlotPointer])
      blankSlotPointer++
    }
    // 超過 maxEmployees 時 employeeSlotMap 不會有此 id，後續直接跳過
  }

  // ------------------------------------------------------------------
  // 步驟 3：計算 selectedMonths 對應的欄 index（預先計算，避免重複查找）
  // ------------------------------------------------------------------
  /** @type {Array<{monthName: string, colIdx: number}>} */
  const selectedMonthCols = selectedMonths
    .map((m) => ({ monthName: m, colIdx: monthColumnIndices[m] }))
    .filter(({ colIdx }) => colIdx != null)

  // ------------------------------------------------------------------
  // 步驟 4：填入每個員工的資料
  // ------------------------------------------------------------------

  /**
   * 安全地寫入一個 cell
   * @param {number} r - 0-indexed row
   * @param {number} c - 0-indexed col
   * @param {*} value
   */
  function writeCell(r, c, value) {
    const addr = XLSX.utils.encode_cell({ r, c })
    const isNumber = typeof value === 'number' || (typeof value === 'string' && value !== '' && !isNaN(Number(value)))
    if (isNumber) {
      ws[addr] = { v: Number(value), t: 'n' }
    } else {
      ws[addr] = { v: value, t: 's' }
    }
  }

  for (const empId of employeeIds) {
    if (!employeeSlotMap.has(empId)) continue // 超過 maxEmployees，略過

    const slotIdx = employeeSlotMap.get(empId)
    const slotStartRow = firstEmployeeRowIndex + slotIdx * groupSize

    // ------------------------------------------------------------------
    // 4a. 填入 identity 欄位（寫在 offset 0 那一 row）
    // ------------------------------------------------------------------
    const identityRow = slotStartRow // offset 0

    for (const [templateField, sourceField] of Object.entries(identityMapping)) {
      if (!sourceField) continue
      const colIdx = identityColumns[templateField]
      if (colIdx == null) continue

      // 取該員工任一筆資料（身份資訊各筆應相同，取第一筆）
      const empRows = groups.get(empId)
      if (!empRows || empRows.length === 0) continue
      const value = empRows[0][sourceField]
      if (value == null) continue

      writeCell(identityRow, colIdx, value)
    }

    // ------------------------------------------------------------------
    // 4b. 對每個選定月份，填入薪資項目
    // ------------------------------------------------------------------
    const empRows = groups.get(empId) || []

    for (const { monthName, colIdx: monthColIdx } of selectedMonthCols) {
      // 找到來源中，該員工在此月份的那一筆資料
      const monthRow = empRows.find((row) => {
        const rawMonth = row[monthSourceColumn]
        if (rawMonth == null) return false
        const mappedMonth = monthValueMapping[String(rawMonth).trim()]
        return mappedMonth === monthName
      })

      if (!monthRow) continue // 來源中沒有此員工此月份的資料，跳過

      // 對每個有設定的薪資項目寫入對應 cell
      for (const [templateItem, sourceField] of Object.entries(salaryMapping)) {
        if (!sourceField) continue // null 表示不填

        const itemOffset = salaryItemOffsets[templateItem]
        if (itemOffset == null) continue // 不認識的項目名稱，略過

        const itemRow = slotStartRow + itemOffset
        const value = monthRow[sourceField]
        if (value == null) continue

        writeCell(itemRow, monthColIdx, value)
      }
    }
  }

  // ------------------------------------------------------------------
  // 步驟 5：更新 sheet range，確保 XLSX.write() 能正確輸出所有 cell
  // ------------------------------------------------------------------
  updateSheetRange(ws)

  return workbook
}

/**
 * 重新計算 ws['!ref']，確保涵蓋所有已寫入的 cell。
 * SheetJS 不會在手動寫入 cell 後自動更新 range。
 *
 * @param {import('xlsx').WorkSheet} ws
 */
function updateSheetRange(ws) {
  let minR = Infinity, minC = Infinity
  let maxR = -Infinity, maxC = -Infinity

  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue // 跳過 metadata key
    const { r, c } = XLSX.utils.decode_cell(addr)
    if (r < minR) minR = r
    if (r > maxR) maxR = r
    if (c < minC) minC = c
    if (c > maxC) maxC = c
  }

  if (minR === Infinity) return // 空 sheet，不更新

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: minR, c: minC },
    e: { r: maxR, c: maxC },
  })
}
