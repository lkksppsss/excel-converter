import { useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import TemplateUploadStep from '../components/templateFill/TemplateUploadStep'
import ExcelImportConfig from '../components/upload/ExcelImportConfig'
import TemplateMappingStep from '../components/templateFill/TemplateMappingStep'
import { fillTemplate } from '../utils/templateFiller.js'

// 狀態機：'upload' → 'source-config' → 'mapping'
export default function TemplateFillPage({ onBack }) {
  const [step, setStep] = useState('upload')

  // 來自 upload step
  const [sourceWorkbook, setSourceWorkbook] = useState(null)
  const [templateWorkbook, setTemplateWorkbook] = useState(null)
  const [templateStructure, setTemplateStructure] = useState(null)
  const [filledMonths, setFilledMonths] = useState([])

  // 來自 ExcelImportConfig
  const [sourceRows, setSourceRows] = useState([])
  const [sourceHeaders, setSourceHeaders] = useState([])
  const [importConfig, setImportConfig] = useState(null)  // 保留設定供回上一步用

  function handleUploadReady(srcWb, tmplWb, structure, months) {
    setSourceWorkbook(srcWb)
    setTemplateWorkbook(tmplWb)
    setTemplateStructure(structure)
    setFilledMonths(months)
    setStep('source-config')
  }

  function handleImportConfirm({ headers, rows, selectedSheets, colDefs }) {
    setSourceHeaders(headers)
    setSourceRows(rows)
    setImportConfig({ selectedSheets, colDefs })
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
        <TemplateUploadStep onReady={handleUploadReady} />
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
        <TemplateMappingStep
          sourceHeaders={sourceHeaders}
          sourceRows={sourceRows}
          templateWorkbook={templateWorkbook}
          templateStructure={templateStructure}
          filledMonths={filledMonths}
          onBack={() => setStep('source-config')}
          onExport={handleExport}
        />
      )}
    </>
  )
}
