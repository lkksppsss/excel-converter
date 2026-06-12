// ExcelTableRenderer 的 highlight type 常數與工具。
// 與元件分開存放，因為 react-refresh 要求元件檔只 export 元件。

// 填入區依序套用 6 色循環
export function zoneHighlightType(index) {
  return `zone-${index % 6}`
}
