import { useState } from 'react'
import UploadPanel from '../components/upload/UploadPanel'
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
          className={`${styles.card} ${styles.cardDisabled}`}
          onClick={() => onSelect('template-stub')}
        >
          <span className={styles.comingSoonBadge}>即將推出</span>
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

function TemplateStub({ onBack }) {
  return (
    <div className={styles.stubWrapper}>
      <p className={styles.stubMessage}>模板填入功能即將推出</p>
      <button className={styles.backButton} onClick={onBack}>
        返回首頁
      </button>
    </div>
  )
}

export default function HomePage() {
  const [sourceFields, setSourceFields] = useState([])
  const [sourceRows, setSourceRows] = useState([])
  const [targetFields, setTargetFields] = useState([])
  const [step, setStep] = useState('home')

  function handleFilesReady(source, target, rows) {
    setSourceFields(source)
    setTargetFields(target)
    setSourceRows(rows)
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
      {step === 'mapping' && (
        <MappingCanvas
          sourceFields={sourceFields}
          targetFields={targetFields}
          sourceRows={sourceRows}
          onBack={() => setStep('upload')}
        />
      )}
      {step === 'template-stub' && (
        <TemplateStub onBack={() => setStep('home')} />
      )}
    </div>
  )
}
