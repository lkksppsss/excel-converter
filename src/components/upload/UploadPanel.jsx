import { useState, useCallback } from 'react'
import { parseExcelHeaders } from '../../utils/excel'
import { readSheetJSWorkbook } from '../../utils/fileParser/fileParserFactory'
import styles from './UploadPanel.module.css'

function FileDropZone({ label, hint, onFile, file, error, loading, children }) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFile(dropped)
  }, [onFile])

  const handleChange = (e) => {
    const selected = e.target.files[0]
    if (selected) onFile(selected)
  }

  return (
    <div
      className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''} ${file ? styles.hasFile : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <label className={styles.dropLabel}>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleChange}
          className={styles.hiddenInput}
        />
        <div className={styles.dropIcon}>{file ? '✅' : '📂'}</div>
        <div className={styles.dropTitle}>{label}</div>
        <div className={styles.dropHint}>{hint}</div>
        {file && <div className={styles.fileName}>{file.name}</div>}
      </label>

      {loading && <div className={styles.loading}>解析中...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {children}
    </div>
  )
}

export default function UploadPanel({ onReady }) {
  const [sourceFile, setSourceFile] = useState(null)
  const [targetFile, setTargetFile] = useState(null)
  const [sourceWorkbook, setSourceWorkbook] = useState(null)
  const [targetFields, setTargetFields] = useState(null)
  const [sourceError, setSourceError] = useState('')
  const [targetError, setTargetError] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [targetLoading, setTargetLoading] = useState(false)

  async function handleSourceFile(file) {
    setSourceFile(file)
    setSourceError('')
    setSourceLoading(true)
    try {
      const wb = await readSheetJSWorkbook(file)
      setSourceWorkbook(wb)
    } catch (e) {
      setSourceError(e.message)
    } finally {
      setSourceLoading(false)
    }
  }

  async function handleTargetFile(file) {
    setTargetFile(file)
    setTargetError('')
    setTargetLoading(true)
    try {
      const fields = await parseExcelHeaders(file)
      setTargetFields(fields)
    } catch (e) {
      setTargetError(e.message)
    } finally {
      setTargetLoading(false)
    }
  }

  const canProceed = sourceWorkbook !== null && targetFields && targetFields.length > 0

  function handleStart() {
    if (canProceed) onReady(sourceWorkbook, targetFields)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h1 className={styles.heading}>開始轉換 Excel 格式</h1>
        <p className={styles.subheading}>
          上傳來源檔案與目標格式範本，系統將幫您建立欄位對應關係
        </p>
      </div>

      <div className={styles.dropzones}>
        <FileDropZone
          label="來源 Excel 檔案"
          hint="拖曳或點擊上傳 .xlsx / .xls / .csv"
          onFile={handleSourceFile}
          file={sourceFile}
          error={sourceError}
          loading={sourceLoading}
        >
          {sourceWorkbook && (
            <div className={styles.preview}>
              <div className={styles.previewTitle}>
                {sourceWorkbook.SheetNames.length} 個工作表 — 下一步設定欄位標題
              </div>
              <div className={styles.fieldTags}>
                {sourceWorkbook.SheetNames.slice(0, 5).map((name, i) => (
                  <span key={i} className={styles.fieldTag}>{name}</span>
                ))}
                {sourceWorkbook.SheetNames.length > 5 && (
                  <span className={styles.fieldTagMore}>+{sourceWorkbook.SheetNames.length - 5} 更多</span>
                )}
              </div>
            </div>
          )}
        </FileDropZone>

        <div className={styles.arrow}>→</div>

        <FileDropZone
          label="目標格式範本"
          hint="拖曳或點擊上傳 .xlsx / .xls / .csv"
          onFile={handleTargetFile}
          file={targetFile}
          error={targetError}
          loading={targetLoading}
        >
          {targetFields && targetFields.length > 0 && (
            <div className={styles.preview}>
              <div className={styles.previewTitle}>偵測到 {targetFields.length} 個欄位：</div>
              <div className={styles.fieldTags}>
                {targetFields.slice(0, 8).map((f, i) => (
                  <span key={i} className={styles.fieldTag}>{f}</span>
                ))}
                {targetFields.length > 8 && (
                  <span className={styles.fieldTagMore}>+{targetFields.length - 8} 更多</span>
                )}
              </div>
            </div>
          )}
        </FileDropZone>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.startBtn}
          disabled={!canProceed}
          onClick={handleStart}
        >
          {canProceed ? '下一步：設定來源欄位 →' : '請先上傳兩個 Excel 檔案'}
        </button>
      </div>
    </div>
  )
}
