import { useState } from 'react'
import UploadPanel from '../components/upload/UploadPanel'
import MappingCanvas from '../components/mapper/MappingCanvas'
import styles from './HomePage.module.css'

export default function HomePage() {
  const [sourceFields, setSourceFields] = useState([])
  const [sourceRows, setSourceRows] = useState([])
  const [targetFields, setTargetFields] = useState([])
  const [step, setStep] = useState('upload')

  function handleFilesReady(source, target, rows) {
    setSourceFields(source)
    setTargetFields(target)
    setSourceRows(rows)
    setStep('mapping')
  }

  return (
    <div className={styles.page}>
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
    </div>
  )
}
