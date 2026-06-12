import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadPanel from '../components/upload/UploadPanel'
import ExcelImportConfig from '../components/upload/ExcelImportConfig'
import MappingCanvas from '../components/mapper/MappingCanvas'
import styles from './HomePage.module.css'

function HomeSelection({ onSelect }) {
  return (
    <div className={styles.selectionWrapper}>
      <h1 className={styles.heading}>請選擇功能</h1>
      <div className={styles.cardGrid}>
        <button
          className={styles.card}
          onClick={() => onSelect('upload')}
        >
          <div className={styles.cardIcon}>🗂️</div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>欄位對應</h2>
            <p className={styles.cardDesc}>
              上傳兩份 Excel，拖曳連線建立欄位映射，輸出轉換後的檔案
            </p>
          </div>
        </button>

        <button
          className={styles.card}
          onClick={() => onSelect('template-fill')}
        >
          <div className={styles.cardIcon}>📋</div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>範本資料填入</h2>
            <p className={styles.cardDesc}>
              把資料填入固定格式的 Excel 範本，保留原始格式與結構
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [sourceWorkbook, setSourceWorkbook] = useState(null)
  const [sourceFields, setSourceFields] = useState([])
  const [sourceRows, setSourceRows] = useState([])
  const [targetFields, setTargetFields] = useState([])
  const [step, setStep] = useState('home')
  const [importConfig, setImportConfig] = useState(null)

  // UploadPanel 完成後：拿到 workbook + targetFields
  function handleFilesReady(workbook, target) {
    setSourceWorkbook(workbook)
    setTargetFields(target)
    setImportConfig(null)  // 新檔案，清除舊設定
    setStep('source-config')
  }

  // ExcelImportConfig 確認後：拿到 headers + rows
  function handleImportConfirm({ headers, rows, selectedSheets, colDefs }) {
    setSourceFields(headers)
    setSourceRows(rows)
    setImportConfig({ selectedSheets, colDefs })
    setStep('mapping')
  }

  function handleSelect(target) {
    // 通用範本填入有自己的路由（新版，規格書功能 2）
    if (target === 'template-fill') {
      navigate('/template-fill')
      return
    }
    setStep(target)
  }

  return (
    <div className={styles.page}>
      {step === 'home' && (
        <HomeSelection onSelect={handleSelect} />
      )}
      {step === 'upload' && (
        <UploadPanel onReady={handleFilesReady} />
      )}
      {step === 'source-config' && (
        <ExcelImportConfig
          workbook={sourceWorkbook}
          onConfirm={handleImportConfirm}
          onCancel={() => setStep('upload')}
          initialConfig={importConfig}
        />
      )}
      {step === 'mapping' && (
        <MappingCanvas
          sourceFields={sourceFields}
          targetFields={targetFields}
          sourceRows={sourceRows}
          onBack={() => setStep('source-config')}
        />
      )}
    </div>
  )
}
