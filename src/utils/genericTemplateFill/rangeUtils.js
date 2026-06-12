// A1 座標與範圍的純函式工具。
// range 物件格式：{ s: {r, c}, e: {r, c} }，r/c 皆為 0-indexed，s 保證在 e 的左上方。
// 對外（config、UI 顯示）一律使用 A1 字串（例如 'B4:B15'），物件格式只在計算時使用。
//
// 開放範圍（range spec）：r 或 c 可為 null，表示該維度未綁定，
// 解析時依工作表實際大小展開 —— 'A:F' = 整欄（各工作表列數不同時各自延伸）、'2:5' = 整列。

export function colIndexToLetter(c) {
  let s = ''
  let n = c
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

export function colLetterToIndex(letters) {
  let n = 0
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

export function encodeCell({ r, c }) {
  return `${colIndexToLetter(c)}${r + 1}`
}

export function parseCell(addr) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(String(addr).trim())
  if (!m) throw new Error(`無效的儲存格座標：${addr}`)
  return { r: parseInt(m[2], 10) - 1, c: colLetterToIndex(m[1]) }
}

export function normalizeRange({ s, e }) {
  return {
    s: { r: Math.min(s.r, e.r), c: Math.min(s.c, e.c) },
    e: { r: Math.max(s.r, e.r), c: Math.max(s.c, e.c) },
  }
}

export function parseRange(str) {
  const [a, b] = String(str).split(':')
  const s = parseCell(a)
  return normalizeRange({ s, e: b ? parseCell(b) : s })
}

export function encodeRange(range) {
  const { s, e } = normalizeRange(range)
  const a = encodeCell(s)
  const b = encodeCell(e)
  return a === b ? a : `${a}:${b}`
}

// 範圍內所有儲存格，row-major 順序（由上而下、由左而右）
export function cellsInRange(range) {
  const { s, e } = normalizeRange(range)
  const cells = []
  for (let r = s.r; r <= e.r; r++) {
    for (let c = s.c; c <= e.c; c++) {
      cells.push({ r, c })
    }
  }
  return cells
}

export function rangeSize(range) {
  const { s, e } = normalizeRange(range)
  const rows = e.r - s.r + 1
  const cols = e.c - s.c + 1
  return { rows, cols, count: rows * cols }
}

export function isCellInRange({ r, c }, range) {
  const { s, e } = normalizeRange(range)
  return r >= s.r && r <= e.r && c >= s.c && c <= e.c
}

// ── 開放範圍（range spec） ──

// 支援 'B4'、'B4:C9'、'A:F'（整欄）、'2:5'（整列）、'B3:B'（從 B3 到 B 欄資料底端）
export function parseRangeSpec(str) {
  const text = String(str).trim()
  let m = /^([A-Za-z]+):([A-Za-z]+)$/.exec(text)
  if (m) {
    const c1 = colLetterToIndex(m[1])
    const c2 = colLetterToIndex(m[2])
    return { s: { r: null, c: Math.min(c1, c2) }, e: { r: null, c: Math.max(c1, c2) } }
  }
  m = /^(\d+):(\d+)$/.exec(text)
  if (m) {
    const r1 = parseInt(m[1], 10) - 1
    const r2 = parseInt(m[2], 10) - 1
    return { s: { r: Math.min(r1, r2), c: null }, e: { r: Math.max(r1, r2), c: null } }
  }
  m = /^([A-Za-z]+)(\d+):([A-Za-z]+)$/.exec(text)
  if (m) {
    // 'B3:B' = 起點固定、列開放到資料底端
    return normalizeRangeSpec({
      s: { r: parseInt(m[2], 10) - 1, c: colLetterToIndex(m[1]) },
      e: { r: null, c: colLetterToIndex(m[3]) },
    })
  }
  return parseRange(text)
}

// 同一維度中只有一端為 null 時，null 代表「到資料底端」，固定放在 e
function normalizeDimension(a, b) {
  if (a === null && b === null) return [null, null]
  if (a === null || b === null) return [a ?? b, null]
  return [Math.min(a, b), Math.max(a, b)]
}

export function normalizeRangeSpec({ s, e }) {
  const [sr, er] = normalizeDimension(s.r, e.r)
  const [sc, ec] = normalizeDimension(s.c, e.c)
  return { s: { r: sr, c: sc }, e: { r: er, c: ec } }
}

export function encodeRangeSpec(spec) {
  const { s, e } = normalizeRangeSpec(spec)
  if (s.r === null) return `${colIndexToLetter(s.c)}:${colIndexToLetter(e.c)}`
  if (s.c === null) return `${s.r + 1}:${e.r + 1}`
  if (e.r === null) return `${encodeCell(s)}:${colIndexToLetter(e.c)}` // 'B3:B'
  return encodeRange({ s, e })
}

// 依工作表實際大小展開未綁定的維度；已綁定的維度原樣保留（不裁切）
export function resolveRangeSpec(spec, { rowCount, colCount }) {
  return normalizeRange({
    s: { r: spec.s.r ?? 0, c: spec.s.c ?? 0 },
    e: {
      r: spec.e.r ?? Math.max(rowCount - 1, 0),
      c: spec.e.c ?? Math.max(colCount - 1, 0),
    },
  })
}
