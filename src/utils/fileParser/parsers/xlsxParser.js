import ExcelJS from 'exceljs'

async function readWorkbook(file) {
  const arrayBuffer = await file.arrayBuffer()
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(arrayBuffer)
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })
      return row
    })
    return { headers, rows }
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  const worksheet = workbook.worksheets[0]

  const headers = []
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? '').trim())
  })

  const rows = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const rowData = {}
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) rowData[header] = cell.value ?? ''
    })
    rows.push(rowData)
  })

  return { headers, rows }
}

export async function parseHeaders(file) {
  const { headers } = await readWorkbook(file)
  return headers.filter(h => h !== '')
}

export async function parseData(file) {
  return await readWorkbook(file)
}
