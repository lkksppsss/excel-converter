---
name: feedback-multiagent
description: 多代理人協作的工作方式與測試 Agent 的行為規範
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d64652b0-a81c-494d-adb1-734336c59a4e
---

## 多代理人分工模式

統管（主 Agent）+ 開發 Agent + 測試 Agent 三角色分工有效，流程：
1. 開發 Agent 實作功能（worktree 或主目錄）
2. 測試 Agent 跑 Playwright 截圖驗證，回報 bug
3. 開發 Agent 修 bug
4. 測試 Agent 再次驗證修復

**Why:** 測試 Agent 獨立找到了 `getFilledMonths` 誤判 bug，且 bug 修完後能獨立驗證，不需統管介入。

**How to apply:** 複雜 UI 功能開發時採此三角色模式；簡單修改或單檔改動直接做即可，不需多 agent。

---

## 測試 Agent 行為規範

測試 Agent 的 prompt 必須明確加入以下限制：

1. **只能用 Playwright MCP 工具**（`mcp__playwright__browser_*`），禁止在專案目錄寫任何 `.js/.mjs/.cjs` 測試腳本
2. **截圖統一存到 `screenshots/` 資料夾**，命名有序（如 `01-*.png`）
3. 測試結束後 `screenshots/` 內容由統管決定是否保留，不納入 commit

**Why:** 測試 Agent 在 Playwright MCP 遇到困難時會自救寫 Puppeteer/Node 腳本，這些腳本用完就成垃圾檔案留在專案根目錄，需手動清理。

**How to apply:** 每次撰寫測試 Agent prompt 時，在最後加上這兩條限制。

---

## Worktree 與主目錄

Agent 用 `isolation: "worktree"` 時，實際可能直接在主工作目錄操作（視 harness 行為而定）。
統管應在 Agent 完成後用 `git status` 確認變更落在哪裡，再決定如何 stage。

**Why:** 上次 worktree 設定的 Agent 最終改動直接出現在主目錄，若不確認直接處理可能誤判。
