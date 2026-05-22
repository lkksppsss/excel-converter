import * as XLSX from 'xlsx'

export function parseExcelHeaders(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (!jsonData || jsonData.length === 0) {
          resolve([])
          return
        }

        const headers = (jsonData[0] || [])
          .map(String)
          .filter(h => h.trim() !== '')

        resolve(headers)
      } catch (err) {
        reject(new Error(`Excel 解析失敗：${err.message}`))
      }
    }

    reader.onerror = () => reject(new Error('檔案讀取失敗'))
    reader.readAsArrayBuffer(file)
  })
}

export function parseExcelData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        const headers = (rawRows[0] || []).map(String).filter(h => h.trim() !== '')

        resolve({ headers, rows })
      } catch (err) {
        reject(new Error(`Excel 解析失敗：${err.message}`))
      }
    }

    reader.onerror = () => reject(new Error('檔案讀取失敗'))
    reader.readAsArrayBuffer(file)
  })
}
