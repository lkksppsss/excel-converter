import { useState, useCallback } from 'react'
import styles from './FileDropZone.module.css'

export default function FileDropZone({
  label,
  hint,
  accept = '.xlsx',
  file,
  error,
  isLoading,
  onFile,
  children,
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) onFile(dropped)
    },
    [onFile]
  )

  const handleChange = (e) => {
    const selected = e.target.files[0]
    if (selected) onFile(selected)
    e.target.value = ''
  }

  return (
    <div
      className={`${styles.dropzone} ${isDragOver ? styles.dragOver : ''} ${file ? styles.hasFile : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
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
        {hint && <div className={styles.dropHint}>{hint}</div>}
        {file && <div className={styles.fileName}>{file.name}</div>}
      </label>

      {isLoading && <div className={styles.loading}>解析中...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {children}
    </div>
  )
}
