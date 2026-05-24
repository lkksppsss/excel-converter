# Excel 智慧格式轉換工具 — CLAUDE.md

純前端 SaaS，目標市場台灣會計事務所。讓用戶上傳兩份 Excel，用拖曳連線建立欄位對應，輸出轉換後的 Excel。

完整規格：AI-Nexus-Lab 專案下的 `projects/excel-converter/project-spec.md`

---

## AI 記憶檔案

Claude Code 的跨對話記憶存在 `.claude/memory/`（已納入 git）。

**換新機器時，執行一次：**
```powershell
# Windows — 將專案記憶複製到 Claude Code 的本機記憶路徑
$src = "$PWD\.claude\memory"
$dest = "$env:USERPROFILE\.claude\projects\$($PWD.Path.Replace('\','-').Replace(':','') -replace '^-','')\memory"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item "$src\*" $dest -Force
```

之後每次更新記憶，兩邊都會同步（Claude Code 寫本機路徑，git 追蹤 `.claude/memory/`）。

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
├── App.jsx                          # BrowserRouter + Routes
├── main.jsx
├── index.css                        # 全域 reset，font-family 含中文字體
├── pages/
│   └── HomePage.jsx                 # step 狀態機：'upload' | 'mapping'
├── components/
│   ├── layout/
│   │   ├── Header.jsx               # 深色 header，品牌名稱
│   │   └── Layout.jsx               # Outlet wrapper
│   ├── upload/
│   │   └── UploadPanel.jsx          # 雙區塊拖曳上傳，SheetJS 解析欄位
│   └── mapper/
│       ├── FieldNode.jsx            # SourceFieldNode / TargetFieldNode
│       └── MappingCanvas.jsx        # React Flow 畫布，匯出邏輯
└── utils/
    └── excel.js                     # parseExcelHeaders / parseExcelData
```

---

## 已完成功能（MVP 功能 1）

### 上傳頁（UploadPanel）
- 左右兩個 FileDropZone，接受 .xlsx / .xls / .csv
- 上傳後用 SheetJS `parseExcelData` 解析第一列為欄位標題，同時保留資料列（`rows`）
- 顯示欄位 tag 預覽（最多 8 個，超過顯示 +N）
- 兩個檔案都解析完畢後啟用「開始設定欄位對應」按鈕
- `onReady(sourceFields, targetFields, sourceRows)` 傳給 HomePage

### 對應畫面（MappingCanvas）
- React Flow 畫布：左欄來源 node（藍紫色）、右欄目標 node（綠色）
- 從來源 node 右側 handle 拖曳到目標 node 左側 handle 建立連線
- 連線為動畫藍色虛線（`animated: true`）
- 點擊連線可刪除
- 已連線 node 變色（來源藍、目標深綠）
- Toolbar 顯示「已對應 N 組」badge

### 匯出
- 依 edges 建立 `{ 來源欄位: 目標欄位 }` mapping
- 對 sourceRows 逐列套用 mapping，產生新欄位名稱的資料列
- SheetJS 輸出「轉換結果.xlsx」並下載

---

## 待完成功能

### 功能 2：AI 欄位建議（BYOK）— 設計已確認

**API Key 管理**
- Key 存 **`sessionStorage`**（關分頁即清，避免公用電腦殘留）
- 未來商業化上後端後，改由平台提供 key，BYOK 整個移除

**AI Provider — 工廠模式**
- MVP 實作 **Gemini**（`gemini-3.5-flash`，免費額度供開發測試）
- `src/utils/ai/` 目錄下用工廠模式抽象 Provider 介面，未來加 Claude / OpenAI 只需新增一個 provider 檔案
- 結構：`aiProviderFactory.js` + `providers/gemini.js`

**UI 流程**
- Header 右上角**齒輪 icon → 設定 Modal**，填寫 API Key
- 無 Key 時「AI 建議」按鈕**仍顯示**，點了直接開設定 Modal 引導填寫
- Loading 時：按鈕 spinner + disabled，**畫布加半透明遮罩**防止操作
- 完成後遮罩消失，預填連線出現

**AI 建議邏輯**
- 送出：來源欄位陣列 + 目標欄位陣列
- 回傳格式：`[{"from": "來源欄位", "to": "目標欄位", "confidence": 0.92}]`
- 信心分數顯示：≥0.8 藍色實線，0.5–0.8 橘色虛線，<0.5 不畫線
- **只填空的目標欄位**，已有手動連線的保留不動

**錯誤處理**
- 任何失敗都不動現有連線，Toast 通知
- API Key 無效（401）→ 清除 sessionStorage + 提示重新設定
- 額度用完（429）→ 明確提示配額已用完
- 網路錯誤 / JSON 解析失敗 → Toast 提示重試

### 功能 3：模板儲存與套用
- 對應設定完可命名存成模板，存入 `localStorage`
- 下次進入可從 Header 或首頁選擇已存模板，直接套用欄位對應
- 支援匯出模板為 JSON 檔（備份）
- 支援匯入 JSON 檔還原模板（跨裝置）

---

## 已知修復與重要技術細節

### React Flow canvas 高度問題
**症狀：** 進入對應畫面後 canvas 空白，nodes 不顯示。
**根因：** `.root` 使用 `min-height: 100vh` 而非 `height: 100vh`，導致 flex 鏈無有界高度，React Flow container 高度為 0。
**修法：** `Layout.module.css` 的 `.root` 改 `height: 100vh`；每一層 flex 子元素（`.main`、`.page`、`.wrapper`、`.canvas`）加 `min-height: 0`。

### React Flow 連線拖曳
節點不可拖移（`draggable: false`），只能從 handle 拖曳連線。來源節點右側 handle（`type="source"`），目標節點左側 handle（`type="target"`）。

### 資料流
```
UploadPanel → onReady(sourceFields, targetFields, sourceRows)
HomePage    → 傳給 MappingCanvas
MappingCanvas → edges → handleExport() → 轉換結果.xlsx
```

---

## 開發工具設定

### Playwright MCP（UI 自動化測試）
已安裝在 local config（`~/.claude.json`），重啟 Claude Code 後即可用。
工具名稱前綴：`mcp__playwright__browser_*`

常用流程：
```
browser_navigate → browser_file_upload → browser_click → browser_run_code_unsafe（拖曳連線）→ browser_take_screenshot
```

拖曳連線需用 `browser_run_code_unsafe` 搭配 `page.mouse` API：
```js
async (page) => {
  const srcHandle = page.locator('[data-nodeid="src-0"].react-flow__handle')
  const tgtHandle = page.locator('[data-nodeid="tgt-0"].react-flow__handle')
  const srcBox = await srcHandle.boundingBox()
  const tgtBox = await tgtHandle.boundingBox()
  await page.mouse.move(srcBox.x + srcBox.width/2, srcBox.y + srcBox.height/2)
  await page.mouse.down()
  // 分步移動...
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

- 跨專案規格文件集中放在 AI-Nexus-Lab 專案的 `projects/<專案名>/` 目錄下（路徑依機器而異，需自行找到 AI-Nexus-Lab 的位置）
- 規格書由 `/grill-me` 訪談產出，動工前先讀規格書
- 複雜任務用 Agent Teams 並行分工（每個 Agent 擁有獨立檔案集合，避免衝突）
- UI 變更後用 Playwright MCP 自動截圖驗證，不等用戶手動回報
- 介面語言：繁體中文
