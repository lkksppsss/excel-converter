import { useEffect, useMemo, useRef, useState } from 'react'
import {
  colIndexToLetter,
  encodeRangeSpec,
  isCellInRange,
  normalizeRangeSpec,
  parseRangeSpec,
  resolveRangeSpec,
} from '../../utils/genericTemplateFill/rangeUtils'
import styles from './ExcelTableRenderer.module.css'

// highlight type → CSS class（zone 用 6 色循環）
const HIGHLIGHT_CLASS = {
  header: styles.hlHeader,
  data: styles.hlData,
  filled: styles.hlFilled,
  'zone-0': styles.hlZone0,
  'zone-1': styles.hlZone1,
  'zone-2': styles.hlZone2,
  'zone-3': styles.hlZone3,
  'zone-4': styles.hlZone4,
  'zone-5': styles.hlZone5,
}

// 依拖曳起點的種類調整新格子：整欄拖曳只看欄、整列拖曳只看列
function matchKind(anchor, cell) {
  if (anchor.r === null) return { r: null, c: cell.c }
  if (anchor.c === null) return { r: cell.r, c: null }
  return cell
}

/**
 * 把 Excel sheet model 渲染成 HTML table。
 *
 * 選取方式（selectable 時）：
 * - 在格子上拖曳框選矩形範圍 → 'B4:C9'
 * - 點擊／拖曳上方欄字母 → 整欄 'A:C'（開放範圍，依工作表實際列數延伸）
 * - 點擊／拖曳左側列號 → 整列 '2:5'
 * - Shift + 點擊：從上一次起點延伸
 *
 * @param {object}   props.model          getSheetModel() 的結果
 * @param {boolean}  props.selectable     是否啟用選取
 * @param {Function} props.onRangeSelect  選取完成 callback，參數為 A1 範圍字串
 * @param {Array}    props.highlights     [{ range: 'A1:F1' | 'A:F' | '2:5', type: 'header' | 'data' | 'filled' | 'zone-N' }]
 * @param {object}   props.overrides      { 'r:c': 顯示文字 } 預覽時覆寫儲存格內容（自帶 filled 樣式）
 */
export default function ExcelTableRenderer({
  model,
  selectable = false,
  onRangeSelect,
  highlights = [],
  overrides = {},
}) {
  const [drag, setDrag] = useState(null) // { anchor, focus }，r/c 為 null 表示整欄/整列
  const anchorRef = useRef(null) // 最後一次選取的起點，供 Shift+點擊延伸

  const modelBounds = useMemo(
    () => ({ rowCount: model?.rowCount || 0, colCount: model?.colCount || 0 }),
    [model?.rowCount, model?.colCount]
  )

  // 合併儲存格：起點格 → rowSpan/colSpan；其餘被覆蓋的格子不渲染
  const { spanMap, coveredSet } = useMemo(() => {
    const spans = new Map()
    const covered = new Set()
    for (const merge of model?.merges || []) {
      spans.set(`${merge.s.r}:${merge.s.c}`, {
        rowSpan: merge.e.r - merge.s.r + 1,
        colSpan: merge.e.c - merge.s.c + 1,
      })
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r !== merge.s.r || c !== merge.s.c) covered.add(`${r}:${c}`)
        }
      }
    }
    return { spanMap: spans, coveredSet: covered }
  }, [model?.merges])

  // 開放範圍（'A:F' / '2:5'）以顯示中的 model 大小展開來高亮
  const parsedHighlights = useMemo(
    () =>
      highlights
        .filter((h) => h.range)
        .map((h) => ({
          range: resolveRangeSpec(parseRangeSpec(h.range), modelBounds),
          type: h.type,
        })),
    [highlights, modelBounds]
  )

  const dragRange = drag
    ? resolveRangeSpec(normalizeRangeSpec({ s: drag.anchor, e: drag.focus }), modelBounds)
    : null

  // 拖曳中在 window 層級結束選取，避免滑鼠移出表格後 mouseup 漏接
  useEffect(() => {
    if (!drag) return
    function handleMouseUp() {
      anchorRef.current = drag.anchor
      onRangeSelect?.(encodeRangeSpec(normalizeRangeSpec({ s: drag.anchor, e: drag.focus })))
      setDrag(null)
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [drag, onRangeSelect])

  if (!model || model.rowCount === 0) {
    return <div className={styles.empty}>（這個工作表沒有內容）</div>
  }

  function startSelection(e, cell) {
    if (!selectable) return
    e.preventDefault()
    if (e.shiftKey && anchorRef.current) {
      const anchor = anchorRef.current
      onRangeSelect?.(
        encodeRangeSpec(normalizeRangeSpec({ s: anchor, e: matchKind(anchor, cell) }))
      )
      return
    }
    setDrag({ anchor: cell, focus: cell })
  }

  function extendSelection(cell) {
    if (drag) setDrag({ anchor: drag.anchor, focus: matchKind(drag.anchor, cell) })
  }

  function cellClassName(cell) {
    const classes = [styles.cell]
    if (selectable) classes.push(styles.selectableCell)
    for (const h of parsedHighlights) {
      if (isCellInRange(cell, h.range)) {
        const cls = HIGHLIGHT_CLASS[h.type]
        if (cls) classes.push(cls)
      }
    }
    if (overrides[`${cell.r}:${cell.c}`] !== undefined) classes.push(styles.hlFilled)
    if (dragRange && isCellInRange(cell, dragRange)) classes.push(styles.selecting)
    return classes.join(' ')
  }

  const colIndices = Array.from({ length: model.colCount }, (_, c) => c)
  const headerSelectable = selectable ? styles.headerSelectable : ''

  return (
    <div className={styles.wrapper}>
      <div className={styles.scroller}>
        <table className={`${styles.table} ${drag ? styles.dragging : ''}`}>
          <thead>
            <tr>
              <th className={styles.cornerCell} />
              {colIndices.map((c) => (
                <th
                  key={c}
                  className={`${styles.colHeader} ${headerSelectable}`}
                  title={selectable ? '點擊選取整欄（可拖曳多欄）' : undefined}
                  onMouseDown={(e) => startSelection(e, { r: null, c })}
                  onMouseEnter={() => extendSelection({ r: null, c })}
                >
                  {colIndexToLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.cells.map((row, r) => (
              <tr key={r}>
                <th
                  className={`${styles.rowHeader} ${headerSelectable}`}
                  title={selectable ? '點擊選取整列（可拖曳多列）' : undefined}
                  onMouseDown={(e) => startSelection(e, { r, c: null })}
                  onMouseEnter={() => extendSelection({ r, c: null })}
                >
                  {r + 1}
                </th>
                {colIndices.map((c) => {
                  const key = `${r}:${c}`
                  if (coveredSet.has(key)) return null
                  const span = spanMap.get(key)
                  const override = overrides[key]
                  return (
                    <td
                      key={c}
                      className={cellClassName({ r, c })}
                      rowSpan={span?.rowSpan}
                      colSpan={span?.colSpan}
                      onMouseDown={(e) => startSelection(e, { r, c })}
                      onMouseEnter={() => extendSelection({ r, c })}
                    >
                      {override !== undefined ? override : row[c]}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {model.isTruncated && (
        <div className={styles.truncatedNote}>
          內容過大，僅顯示前 {model.rowCount} 列 × {model.colCount} 欄（選取與填入不受影響）
        </div>
      )}
    </div>
  )
}
