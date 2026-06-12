# Excel 智慧轉換 — 架構與編碼規範

> 所有新功能開發前必讀。目的：讓不同功能的程式碼可以獨立修改，不互相影響。

---

## A. 元件切分原則

### 三層職責分離

```
pages/          → 狀態機 + 流程控制，不含任何 UI 細節
components/     → UI 顯示 + 使用者互動，不含業務邏輯
utils/          → 純函式業務邏輯，不含任何 React 或 DOM
```

### 判斷一個東西屬於哪層

| 如果它... | 放在 |
|-----------|------|
| 管理整個流程的步驟（step 狀態機） | `pages/` |
| 顯示 UI、接收使用者操作 | `components/` |
| 解析 Excel、轉換資料、計算結果 | `utils/` |
| 可以在 Node.js 環境執行（不依賴 DOM） | `utils/` |

### 元件細分

```
components/
  common/       → 跨功能共用（FileDropZone、Toast、Modal、TableRenderer）
  featureA/     → 只屬於功能 A 的元件
  featureB/     → 只屬於功能 B 的元件
  layout/       → Header、Layout 等全站框架
```

**規則**：元件不能跨功能直接引用對方的私有元件。需要共用的元件搬到 `common/`。

---

## B. 狀態管理規範

### 狀態放在哪裡

| 狀態類型 | 放在哪 |
|----------|--------|
| 某個步驟的 UI 細節（例如 hover 狀態） | 元件自己的 `useState` |
| 同一頁面內多個子元件共用的資料 | 提升到最近的共同父元件 |
| 整個功能流程的資料（跨步驟） | `pages/` 層的 `useState` |
| 跨功能共用（例如 Toast 通知） | React Context |

### 嚴格禁止

- **禁止** 子元件直接修改父元件的 state（只能透過 callback props）
- **禁止** 在 `utils/` 函式裡使用 `useState`、`useEffect` 或任何 React API
- **禁止** 在 `components/` 裡直接呼叫 SheetJS 或其他 Excel 函式（一律透過 `utils/`）

### sessionStorage 持久化規範

需要跨重整保留的設定統一透過一個 hook 管理：

```js
// utils/useSessionState.js
export function useSessionState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    const stored = sessionStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  })
  const setAndPersist = (v) => {
    sessionStorage.setItem(key, JSON.stringify(v))
    setValue(v)
  }
  return [value, setAndPersist]
}
```

---

## C. CSS Modules 命名規範

### class 命名

- 使用 **camelCase**：`.uploadPanel`、`.headerRow`
- 描述「這是什麼」，不描述「它長什麼樣」：用 `.primaryButton` 不用 `.blueButton`
- 狀態用修飾詞：`.node`、`.nodeConnected`、`.nodeDisabled`

### 模組檔案結構

- 每個元件一個 `.module.css`，與元件同名、同目錄
- 全域樣式只放 `index.css`（reset、字體、CSS 變數）
- 顏色、間距使用 CSS 變數（定義在 `index.css`）：

```css
/* index.css */
:root {
  --color-primary: #5B6EF5;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --radius-md: 8px;
  --spacing-md: 16px;
}
```

---

## D. 資料流向規範

### Props 命名

| 種類 | 格式 | 範例 |
|------|------|------|
| 資料 props | 名詞 | `headers`、`rows`、`mapping` |
| 事件 callback | `on` + 動詞 | `onConfirm`、`onBack`、`onExport` |
| 布林狀態 | `is` / `has` 前綴 | `isLoading`、`hasError` |

### 資料向下，事件向上

```
Page（持有 state）
  ↓  props（資料向下）
  Component
  ↑  callback（事件向上，不傳 setState）
```

**範例**：
```jsx
// 正確：傳 callback
<MappingCanvas edges={edges} onEdgesChange={setEdges} />

// 錯誤：直接傳 setState
<MappingCanvas setEdges={setEdges} />
```

### utils 函式設計

- 純函式，輸入 → 輸出，無副作用
- 參數和回傳值用普通 JS 物件，不依賴 React state 結構
- 命名用動詞：`parseExcelHeaders()`、`fillTemplate()`、`buildMapping()`
- 業務邏輯和 I/O 分開：`fillTemplate(workbook, data, config)` 只做計算，由呼叫端負責讀檔和寫檔

---

## E. 檔案與目錄結構規範

### 目標結構

```
src/
├── App.jsx                    # 路由定義，不含業務邏輯
├── main.jsx
├── index.css                  # 全域 reset + CSS 變數
├── pages/
│   ├── HomePage.jsx           # 首頁功能選擇卡片
│   ├── FieldMappingPage.jsx   # 欄位對應轉換流程
│   └── TemplateFillPage.jsx   # 通用範本填入流程（新版）
├── components/
│   ├── common/                # 跨功能共用元件
│   │   ├── FileDropZone.jsx
│   │   ├── Toast.jsx
│   │   ├── Modal.jsx
│   │   └── ExcelTableRenderer.jsx  # HTML table 渲染 Excel
│   ├── layout/                # Header、Layout
│   ├── fieldMapping/          # 欄位對應轉換專用元件
│   └── templateFill/          # 範本填入專用元件
└── utils/
    ├── useSessionState.js     # 跨重整狀態 hook
    ├── excel/                 # Excel 解析與輸出
    ├── fieldMapping/          # 欄位對應轉換業務邏輯
    └── templateFill/          # 範本填入業務邏輯
```

### 新功能開發流程

1. 在 `utils/<功能名>/` 建立純函式（先寫、先測）
2. 在 `components/<功能名>/` 建立 UI 元件（呼叫 utils）
3. 在 `pages/` 建立 Page（組合元件、管理步驟狀態）
4. 在 `App.jsx` 加路由

### 命名規則

| 種類 | 格式 | 範例 |
|------|------|------|
| Page 元件 | `XxxPage.jsx` | `TemplateFillPage.jsx` |
| 一般元件 | `XxxYyy.jsx` | `MappingCanvas.jsx` |
| CSS Module | 與元件同名 | `MappingCanvas.module.css` |
| util 函式檔 | camelCase | `templateFiller.js` |
| hook | `use` 開頭 | `useSessionState.js` |

---

## 後端遷移預留設計

**核心原則**：把業務邏輯集中在 `utils/`，未來後端化時只需要：
1. 把 `utils/` 的函式搬到後端 API
2. 前端改成呼叫 `fetch`
3. 元件不需要改動

**現在就要做到**：
- Excel 解析、資料轉換、規則計算 — 全部放 `utils/`
- 元件只處理「顯示什麼」和「使用者做了什麼」
- 不在元件裡直接 `new Workbook()`、`XLSX.read()` 等

---

*2026-06-12*
