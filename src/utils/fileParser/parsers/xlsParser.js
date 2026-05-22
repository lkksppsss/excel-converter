import * as XLSX from 'xlsx'

export async function parseHeaders(file) {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  return (rows[0] || []).map(String).filter(h => h.trim() !== '')
}

export async function parseData(file) {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const headers = (rawRows[0] || []).map(String).filter(h => h.trim() !== '')
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return { headers, rows }
}
