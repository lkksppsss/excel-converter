import { useState } from 'react'
import UploadPanel from '../components/upload/UploadPanel'
import ExcelImportConfig from '../components/upload/ExcelImportConfig'
import MappingCanvas from '../components/mapper/MappingCanvas'
import TemplateFillPage from './TemplateFillPage'
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
          onClick={() => onSelect('template-stub')}
        >
          <div className={styles.cardIcon}>📋</div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>模板填入</h2>
            <p className={styles.cardDesc}>
              將您的薪資資料填入標準格式範本，保留原始格式與結構
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
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
      {step === 'template-stub' && (
        <TemplateFillPage onBack={() => setStep('home')} />
      )}
    </div>
  )
}
