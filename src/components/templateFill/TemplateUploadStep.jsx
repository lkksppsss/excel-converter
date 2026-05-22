import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseExcelData } from '../../utils/excel.js'
import { detectTemplateStructure, getFilledMonths } from '../../utils/templateStructure.js'
import styles from './TemplateUploadStep.module.css'

// ── 共用 FileDropZone ──────────────────────────────────────────────────────────
function FileDropZone({ label, hint, accept, onFile, file, loading, error, children }) {
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
          accept={accept}
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

// ── TemplateUploadStep ─────────────────────────────────────────────────────────
export default function TemplateUploadStep({ onReady }) {
  // 來源薪資資料
  const [sourceFile, setSourceFile] = useState(null)
  const [sourceHeaders, setSourceHeaders] = useState(null)
  const [sourceRows, setSourceRows] = useState([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')

  // 薪資清冊範本
  const [templateFile, setTemplateFile] = useState(null)
  const [templateWorkbook, setTemplateWorkbook] = useState(null)
  const [templateStructure, setTemplateStructure] = useState(undefined) // undefined = 未偵測, null = 無法識別
  const [filledMonths, setFilledMonths] = useState([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState('')

  // ── 處理來源檔案 ──────────────────────────────────────────────────────────────
  async function handleSourceFile(file) {
    setSourceFile(file)
    setSourceError('')
    setSourceLoading(true)
    try {
      const { headers, rows } = await parseExcelData(file)
      setSourceHeaders(headers)
      setSourceRows(rows)
    } catch (e) {
      setSourceError(e.message)
    } finally {
      setSourceLoading(false)
    }
  }

  // ── 處理範本檔案 ──────────────────────────────────────────────────────────────
  async function handleTemplateFile(file) {
    setTemplateFile(file)
    setTemplateError('')
    setTemplateLoading(true)
    setTemplateStructure(undefined)
    setFilledMonths([])
    try {
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      setTemplateWorkbook(wb)

      const structure = detectTemplateStructure(wb)
      setTemplateStructure(structure)

      if (structure) {
        const months = getFilledMonths(wb, structure)
        setFilledMonths(months)
      }
    } catch (e) {
      setTemplateError(e.message)
    } finally {
      setTemplateLoading(false)
    }
  }

  // ── 是否可繼續 ────────────────────────────────────────────────────────────────
  const canProceed =
    sourceHeaders && sourceHeaders.length > 0 &&
    templateWorkbook !== null

  function handleProceed() {
    if (canProceed) {
      onReady(sourceRows, sourceHeaders, templateWorkbook, templateStructure, filledMonths)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h1 className={styles.heading}>上傳薪資資料與範本</h1>
        <p className={styles.subheading}>
          上傳您的薪資來源資料，以及薪資印領清冊範本，系統將協助您自動填入
        </p>
      </div>

      <div className={styles.dropzones}>
        {/* 左：來源薪資資料 */}
        <FileDropZone
          label="來源薪資資料"
          hint="拖曳或點擊上傳 .xlsx / .xls / .csv"
          accept=".xlsx,.xls,.csv"
          onFile={handleSourceFile}
          file={sourceFile}
          loading={sourceLoading}
          error={sourceError}
        >
          {sourceHeaders && sourceHeaders.length > 0 && (
            <div className={styles.preview}>
              <div className={styles.previewTitle}>偵測到 {sourceHeaders.length} 個欄位：</div>
              <div className={styles.fieldTags}>
                {sourceHeaders.slice(0, 8).map((f, i) => (
                  <span key={i} className={styles.fieldTag}>{f}</span>
                ))}
                {sourceHeaders.length > 8 && (
                  <span className={styles.fieldTagMore}>+{sourceHeaders.length - 8} 更多</span>
                )}
              </div>
            </div>
          )}
        </FileDropZone>

        {/* 右：薪資清冊範本 */}
        <FileDropZone
          label="薪資清冊範本"
          hint="拖曳或點擊上傳 .xlsx / .xls"
          accept=".xlsx,.xls"
          onFile={handleTemplateFile}
          file={templateFile}
          loading={templateLoading}
          error={templateError}
        >
          {templateStructure !== undefined && !templateLoading && (
            templateStructure !== null
              ? (
                <div className={styles.badgeSuccess}>
                  偵測到薪資清冊格式 ✓
                </div>
              )
              : (
                <div className={styles.badgeWarn}>
                  ⚠ 無法識別格式，請確認是否為薪資印領清冊
                </div>
              )
          )}
        </FileDropZone>
      </div>

      {/* 已填月份提示 */}
      {filledMonths.length > 0 && (
        <div className={styles.filledMonthsNotice}>
          <strong>範本中已有資料的月份：</strong>{filledMonths.join('、')}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.proceedBtn}
          disabled={!canProceed}
          onClick={handleProceed}
        >
          {canProceed ? '繼續設定對應 →' : '請先上傳兩個檔案'}
        </button>
      </div>
    </div>
  )
}
