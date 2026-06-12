# Excel 智慧轉換 — CLAUDE.md

通用 Excel 轉換 SaaS，純前端，無後端。讓使用者上傳 Excel 進行欄位對應轉換，或將資料填入固定格式的範本。

**完整規格**：`docs/project-spec.md`
**架構規範**：`docs/architecture-guide.md`（開發前必讀）

---

## 技術棧

- **React 19 + Vite 8** — 前端框架
- **SheetJS (`xlsx`)** — Excel 讀寫，純前端，無後端
- **@xyflow/react 12** — 拖曳連線畫布（React Flow）
- **react-router-dom 7** — 路由
- **CSS Modules** — 元件樣式隔離，無 Tailwind

---

## 啟動方式

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## 檔案結構

```
src/
├── App.jsx                    # 路由：/ 首頁、/template-fill/:step 新版範本填入、/legacy-template-fill 舊版
├── main.jsx
├── index.css                  # 全域 reset + CSS 變數（--color-primary 等）
├── pages/
│   ├── HomePage.jsx                # 功能選擇卡片（欄位對應 / 範本資料填入）
│   ├── GenericTemplateFillPage.jsx # 通用範本填入流程（新版，功能 2）
│   └── TemplateFillPage.jsx        # 舊版薪資清冊填入（硬碼，已從首頁隱藏，路由保留）
├── components/
│   ├── common/                # 跨功能共用
│   │   ├── FileDropZone.jsx
│   │   ├── ExcelTableRenderer.jsx  # HTML table 渲染 + 拖曳框選 / Shift 延伸選取
│   │   └── excelTableHighlight.js  # highlight type 工具（zone 6 色循環）
│   ├── layout/
│   │   ├── Header.jsx
│   │   └── Layout.jsx
│   ├── upload/
│   │   ├── UploadPanel.jsx        # 雙區塊拖曳上傳
│   │   └── ExcelImportConfig.jsx  # 工作表選擇 + 欄位標記
│   ├── mapper/
│   │   ├── FieldNode.jsx
│   │   └── MappingCanvas.jsx      # React Flow 畫布
│   ├── genericTemplateFill/   # 通用範本填入（新版）專用元件，步驟 1/2 版面統一（設定面板在表格上方）
│   │   ├── StepHeader.jsx         # 4 步驟指示器
│   │   ├── SheetTabs.jsx
│   │   ├── SourceStructureStep.jsx  # 步驟 1：欄位定義配對（標題範圍↔資料範圍＋名稱，自動命名可改）
│   │   ├── TargetStructureStep.jsx  # 步驟 2：填入區配對（標題範圍↔填入範圍＋名稱，.xls 警告）
│   │   ├── MappingRulesStep.jsx     # 步驟 3：對應規則 + 篩選條件（A 欄位等值 / C sheet 名稱）
│   │   └── PreviewExportStep.jsx    # 步驟 4：預覽（預設 3 筆，最多 50）+ 匯出
│   └── templateFill/          # 舊版專用元件（保留）
│       ├── TemplateUploadStep.jsx
│       ├── TemplateMappingStep.jsx
│       └── MappingPreview.jsx
└── utils/
    ├── excel.js
    ├── templateFiller.js
    ├── templateStructure.js
    ├── useSessionState.js     # 跨重整狀態 hook（sessionStorage）
    ├── genericTemplateFill/   # 通用範本填入業務邏輯（純函式，ExcelJS）
    │   ├── rangeUtils.js          # A1 座標 ↔ {r,c} 轉換、範圍運算
    │   ├── workbookReader.js      # ExcelJS 讀檔 + sheet → 可渲染 model
    │   ├── sourceTable.js         # 依標記範圍抽取欄位與資料列
    │   └── fillEngine.js          # 條件篩選 + 計算寫入格 + 套用 + 輸出 Blob
    └── fileParser/
        ├── fileParserFactory.js
        └── parsers/
```

---

## 功能狀態

| 功能 | 狀態 |
|------|------|
| 欄位對應轉換 | ✅ 完成 |
| 薪資清冊模板填入（舊版硬碼） | ⚠️ 已從首頁隱藏，路由保留在 `/legacy-template-fill` |
| 通用範本填入（新版） | ✅ 開發完成（utils 已通過 Node 煙霧測試，UI 待人工測試） |
| 模板儲存與套用 | ❌ 待開發（第 2 優先，預覽頁已預留「儲存為模板」按鈕） |
| AI 欄位建議 | ❌ 待開發（最後） |

---

## 已知修復與重要技術細節

### React Flow canvas 高度問題
**根因：** `.root` 使用 `min-height: 100vh`，導致 flex 鏈無有界高度，React Flow container 高度為 0。
**修法：** `Layout.module.css` 的 `.root` 改 `height: 100vh`；各層 flex 子元素加 `min-height: 0`。

### React Flow 連線拖曳
節點不可拖移（`draggable: false`），只能從 handle 拖曳連線。來源節點右側 handle（`type="source"`），目標節點左側 handle（`type="target"`）。

### 範本格式保留：必須用 ExcelJS，不能用 SheetJS
SheetJS 社群版 `XLSX.write()` 會丟失儲存格樣式（顏色、框線、字體）。通用範本填入（新版）
一律用 ExcelJS：`workbook.xlsx.load()` → 只改 `cell.value` → `writeBuffer()`，樣式、公式、
合併儲存格都會保留。舊版欄位對應功能仍用 SheetJS（不需保留樣式）。

例外：`.xls`（舊版 BIFF）與 `.csv` ExcelJS 讀不了，`readWorkbookFromFile()` 改走 SheetJS
解析再轉成 ExcelJS workbook（只搬值 + 合併儲存格）。來源檔沒差；目標範本用 .xls 會掉樣式，
TargetStructureStep 會顯示警告。

### 通用範本填入的資料流
設定（範圍字串、填入區、規則）全部是可序列化 JSON，存 sessionStorage
（key：`templateFill.sourceConfig` / `targetConfig` / `mappingRules`）；
workbook 二進位只放記憶體，重整後需重新上傳（設定自動還原）。
預覽不修改 workbook —— `buildCellWrites()` 算出的寫入以 overrides 疊在 HTML table 上，
匯出時才 `applyWritesToWorksheet()` 真正寫入。

### 範圍字串格式（rangeUtils）與來源欄位模型
一般範圍 `B4:C9` 之外支援**開放範圍**：`A:F` 整欄、`2:5` 整列、`B3:B` 半開放（從 B3 到欄底；
parse 後 r 或 c 為 null），`resolveRangeSpec()` 依工作表實際大小展開 —— 來源各工作表列數不同時各自延伸。

來源結構 = **欄位定義清單**（`sourceConfig.fields`）：每個欄位 = `{ id, name, headerRange, dataRange }`，
標題與資料範圍成對（`buildFieldDefs()` 把多欄標題自動逐欄拆分配對）。
資料列由各欄位的範圍**依序位對齊**組成（`extractSourceRows()`），
開放範圍會排除該欄位的標題列，「所有欄位皆空」的序位整列略過。
**框選只是輔助**：座標一律經由文字輸入框（可手動輸入 `A2:A500`，不受表格顯示 100 列上限影響）。

---

## 開發工具設定

### Playwright MCP（UI 自動化測試）
已安裝在 local config（`~/.claude.json`）。工具名稱前綴：`mcp__playwright__browser_*`

拖曳連線需用 `browser_run_code_unsafe` 搭配 `page.mouse` API：
```js
async (page) => {
  const srcHandle = page.locator('[data-nodeid="src-0"].react-flow__handle')
  const tgtHandle = page.locator('[data-nodeid="tgt-0"].react-flow__handle')
  const srcBox = await srcHandle.boundingBox()
  const tgtBox = await tgtHandle.boundingBox()
  await page.mouse.move(srcBox.x + srcBox.width/2, srcBox.y + srcBox.height/2)
  await page.mouse.down()
  await page.mouse.up()
}
```

### 測試用 Excel 產生
```bash
node -e "
const XLSX = require('./node_modules/xlsx');
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['欄位A','欄位B']]), 'Sheet1');
XLSX.writeFile(wb, 'test.xlsx');
"
```

---

## 工作方式偏好

- 規格書由 `/grill-me` 訪談產出，動工前先讀 `docs/project-spec.md` 和 `docs/architecture-guide.md`
- 複雜任務用 Agent Teams 並行分工（每個 Agent 擁有獨立檔案集合，避免衝突）
- **不使用 Playwright 或任何自動化測試工具進行開發中驗證**，Playwright 耗 token，留到功能完成後再做測試
- 介面語言：繁體中文
