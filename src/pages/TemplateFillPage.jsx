import { useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import TemplateUploadStep from '../components/templateFill/TemplateUploadStep'
import TemplateMappingStep from '../components/templateFill/TemplateMappingStep'
import { fillTemplate } from '../utils/templateFiller.js'

// 狀態機：'upload' → 'mapping' → (export trigger → back to upload 或 done)
export default function TemplateFillPage({ onBack }) {
  const [step, setStep] = useState('upload')

  // 來自 upload step 的狀態
  const [sourceRows, setSourceRows] = useState([])
  const [sourceHeaders, setSourceHeaders] = useState([])
  const [templateWorkbook, setTemplateWorkbook] = useState(null)
  const [templateStructure, setTemplateStructure] = useState(null)
  const [filledMonths, setFilledMonths] = useState([])

  function handleReady(rows, headers, workbook, structure, months) {
    setSourceRows(rows)
    setSourceHeaders(headers)
    setTemplateWorkbook(workbook)
    setTemplateStructure(structure)
    setFilledMonths(months)
    setStep('mapping')
  }

  async function handleExport(mappingConfig) {
    const filledWb = fillTemplate(templateWorkbook, sourceRows, mappingConfig, templateStructure)
    const buf = XLSX.write(filledWb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      '薪資印領清冊_已填入.xlsx'
    )
  }

  return (
    <>
      {step === 'upload' && (
        <TemplateUploadStep onReady={handleReady} />
      )}
      {step === 'mapping' && (
        <TemplateMappingStep
          sourceHeaders={sourceHeaders}
          sourceRows={sourceRows}
          templateWorkbook={templateWorkbook}
          templateStructure={templateStructure}
          filledMonths={filledMonths}
          onBack={() => setStep('upload')}
          onExport={handleExport}
        />
      )}
    </>
  )
}
