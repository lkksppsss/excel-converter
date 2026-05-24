---
name: project-progress
description: 各功能實作進度與下一步待辦
metadata: 
  node_type: memory
  type: project
  originSessionId: 94188ba7-a375-4f82-867a-c6d0632da2a3
---

## 已完成

### MVP 功能 1 — 欄位對應（flat table → flat table）
- UploadPanel 雙區塊拖曳上傳
- MappingCanvas React Flow 拖曳連線
- 匯出「轉換結果.xlsx」

### 基礎建設
- fileParser 工廠模式：.xls → SheetJS, .xlsx/.csv → ExcelJS
- 首頁雙入口卡片（「欄位對應」、「模板填入」）
- commit: `6e394b0`

### 功能 B — 模板填入（薪資印領清冊）
- `templateStructure.js`：SALARY_PAYROLL_STRUCTURE 常數、detectTemplateStructure、getFilledMonths
- `templateFiller.js`：依身分證號比對 slot、非破壞性逐月填入、支援多月份來源資料
- `TemplateUploadStep`：雙 dropzone、格式偵測徽章、已填月份提示
- `TemplateMappingStep`：三段式對應（身份 / 薪資 / 月份）、數字/中文月份格式切換
- `TemplateFillPage`：upload → mapping 狀態機，fillTemplate + XLSX.write + file-saver 匯出
- commit: `f466495`

### 功能 B 延伸 — 即時預覽面板
- `MappingPreview.jsx`：讀取 templateWorkbook cell 與合併儲存格，直接渲染模板原始格式
- 已對應欄位填入來源資料樣本（藍底），未對應灰底
- 多月份來源資料依身分證號分組，預覽正確顯示不重複員工
- Bug fix：`getFilledMonths` 排除合計/年終/獎金等非月份欄，修正誤判
- 通過單月份與多月份（3員工×3月）Playwright 端對端測試
- commit: `f801217`

**Why:** 讓會計人員在設定對應時能即時看到「填進去長什麼樣」，降低設定錯誤率。

## 待完成

### 功能 2 — AI 欄位建議（BYOK，付費）
- API Key 存 sessionStorage
- 工廠模式：aiProviderFactory + providers/gemini.js
- Header 齒輪 → 設定 Modal
- 信心分數三色連線（≥0.8 實線 / 0.5–0.8 橘虛線 / <0.5 不畫）
- 只填空目標欄位，保留手動連線

### 功能 3 — 模板儲存與套用（localStorage，付費）
- 命名存模板、下次套用
- 匯出/匯入 JSON 備份

### 功能 B 後續
- 支援自訂模板（非薪資印領清冊格式，AI 辨識 → 付費）
- 更多薪資項目（免稅加班費等暫不支援項目）
- 樣式保留優化（.xls 輸入時 styles 轉換）

**How to apply:** 下次開工先從「功能 2 AI 建議」或「功能 3 模板儲存」擇一開始，兩者互相獨立。
