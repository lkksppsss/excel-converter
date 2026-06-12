import { useState } from 'react'

// 跨重整保留的設定統一透過這個 hook 管理（見 docs/architecture-guide.md §B）。
// 只存可 JSON 序列化的設定，Excel 二進位檔案不持久化。
export function useSessionState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setAndPersist = (v) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v))
    } catch {
      // sessionStorage 不可用（隱私模式等）時退化成純 state
    }
    setValue(v)
  }

  return [value, setAndPersist]
}
