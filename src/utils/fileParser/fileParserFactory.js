import * as xlsxParser from './parsers/xlsxParser.js'
import * as xlsParser from './parsers/xlsParser.js'

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
