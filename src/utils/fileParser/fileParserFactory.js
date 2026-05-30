import * as xlsxParser from './parsers/xlsxParser.js'
import * as xlsParser from './parsers/xlsParser.js'
import * as XLSX from 'xlsx'

function getParser(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'xls') return xlsParser
  return xlsxParser  // handles xlsx, csv
}

export async function parseHeaders(file) {
  return getParser(file).parseHeaders(file)
}

export async function parseData(file) {
  return getParser(file).parseData(file)
}

// 回傳 SheetJS workbook，供 ExcelImportConfig 使用
export async function readSheetJSWorkbook(file) {
  const arrayBuffer = await file.arrayBuffer()
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(arrayBuffer)
    return XLSX.read(text, { type: 'string' })
  }
  return XLSX.read(arrayBuffer, { type: 'array' })
}
