import * as XLSX from 'xlsx'

/**
 * 薪資印領清冊範本結構常數
 *
 * Row 0 (0-indexed): 標題列「年度 薪資印領清冊」
 * Row 1 (0-indexed): Header 列
 * Row 2+ : 員工資料，每員工佔 13 rows（含空行 separator）
 */
export const SALARY_PAYROLL_STRUCTURE = {
  type: 'salary-payroll',
  headerRowIndex: 1,
  firstEmployeeRowIndex: 2,
  groupSize: 13,
  maxEmployees: 12,
  identityColumns: {
    '編號': 0,
    '身分證號': 1,
    '所得人姓名': 2,
    '地址': 3,
  },
  salaryItemColumn: 5,
  salaryItemOffsets: {
    '薪資淨額': 0,
    '扣繳稅額': 1,
    '伙食費': 2,
    '免稅加班費': 3,
    '應稅加班費': 4,
    '代扣勞保費': 5,
    '代扣健保費': 6,
    '代扣補充保費': 7,
    '獎金': 8,
    '公司提繳': 9,
    '自願提繳': 10,
    '蓋章': 11,
  },
  monthColumnIndices: {
    '去年十二月': 6,
    '一月': 7,
    '二月': 8,
    '三月': 9,
    '四月': 10,
    '五月': 11,
    '六月': 12,
    '七月': 13,
    '八月': 14,
    '九月': 15,
    '十月': 16,
    '十一月': 17,
    '十二月': 18,
    '去年年終': 19,
    '今年年終': 20,
    '端午獎金': 21,
    '中秋獎金': 22,
    '合計': 23,
  },
}

/**
 * 從 SheetJS workbook 判斷是否為薪資清冊格式。
 *
 * 判斷邏輯：取第一個 sheet，讀取 headerRowIndex（row 1）的所有 cell 值，
 * 確認是否包含「編號」「身分證號」「明細」三個關鍵欄位。
 * 找到就回傳 SALARY_PAYROLL_STRUCTURE，找不到回傳 null。
 *
 * @param {import('xlsx').WorkBook} workbook
 * @returns {typeof SALARY_PAYROLL_STRUCTURE | null}
 */
export function detectTemplateStructure(workbook) {
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return null
  }

  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]

  if (!ws) return null

  const structure = SALARY_PAYROLL_STRUCTURE
  const headerRow = structure.headerRowIndex

  // 收集 header row 所有 cell 的值
  const headerValues = new Set()
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c })
    const cell = ws[cellAddress]
    if (cell && cell.v != null) {
      headerValues.add(String(cell.v).trim())
    }
  }

  // 必須包含這三個關鍵欄位才視為薪資清冊
  const requiredKeys = ['編號', '身分證號', '明細']
  const allFound = requiredKeys.every((key) => headerValues.has(key))

  return allFound ? structure : null
}

/**
 * 讀取目前範本中哪些月份欄已有數值（非空）。
 *
 * 掃描各員工 slot 的第一個薪資項目 row（offset 0，薪資淨額），
 * 找出有值的月份欄，回傳月份名稱陣列。
 *
 * @param {import('xlsx').WorkBook} workbook
 * @param {typeof SALARY_PAYROLL_STRUCTURE} structure
 * @returns {string[]} 例如 ['一月', '二月']
 */
export function getFilledMonths(workbook, structure) {
  if (!workbook || !structure) return []

  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []

  const {
    firstEmployeeRowIndex,
    groupSize,
    maxEmployees,
    salaryItemOffsets,
    monthColumnIndices,
  } = structure

  const filledMonthNames = new Set()
  const firstItemOffset = salaryItemOffsets['薪資淨額'] // offset 0

  for (let slotIdx = 0; slotIdx < maxEmployees; slotIdx++) {
    const itemRow = firstEmployeeRowIndex + slotIdx * groupSize + firstItemOffset

    for (const [monthName, colIdx] of Object.entries(monthColumnIndices)) {
      // 跳過非月份欄（年終、獎金、合計）—— 全部掃描，UI 層自己決定是否過濾
      const cellAddress = XLSX.utils.encode_cell({ r: itemRow, c: colIdx })
      const cell = ws[cellAddress]
      if (cell && cell.v != null && cell.v !== '') {
        filledMonthNames.add(monthName)
      }
    }
  }

  return Array.from(filledMonthNames)
}
