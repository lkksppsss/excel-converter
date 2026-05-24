import { useState } from 'react'
import styles from './TemplateMappingStep.module.css'
import MappingPreview from './MappingPreview'

// ── 常數定義 ──────────────────────────────────────────────────────────────────

const IDENTITY_FIELDS = [
  { key: '身分證號', required: true },
  { key: '所得人姓名', required: true },
  { key: '地址', required: false },
  { key: '編號', required: false },
]

const SALARY_FIELDS_ENABLED = [
  '薪資淨額',
  '扣繳稅額',
  '伙食費',
  '代扣勞保費',
  '代扣健保費',
]

const SALARY_FIELDS_DISABLED = [
  '免稅加班費',
  '應稅加班費',
  '代扣補充保費',
  '獎金',
  '公司提繳',
  '自願提繳',
]

const MONTHS_NUMERIC = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const MONTHS_CHINESE = ['一月', '二月', '三月', '四月', '五月', '六月',
                        '七月', '八月', '九月', '十月', '十一月', '十二月']

// ── 輔助：空欄位選項 ──────────────────────────────────────────────────────────
function ColumnSelect({ value, onChange, sourceHeaders, disabled, placeholder }) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder || '— 請選擇欄位 —'}</option>
      {sourceHeaders.map((h) => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  )
}

// ── TemplateMappingStep ───────────────────────────────────────────────────────
export default function TemplateMappingStep({
  sourceHeaders,
  sourceRows,
  templateWorkbook,
  templateStructure,
  filledMonths,
  onBack,
  onExport,
}) {
  // 區塊 A：身份欄位對應
  const [identityMapping, setIdentityMapping] = useState(() =>
    Object.fromEntries(IDENTITY_FIELDS.map((f) => [f.key, '']))
  )

  // 區塊 B：薪資項目對應
  const [salaryMapping, setSalaryMapping] = useState(() =>
    Object.fromEntries(SALARY_FIELDS_ENABLED.map((f) => [f, '']))
  )

  // 區塊 C：月份設定
  const [monthSourceColumn, setMonthSourceColumn] = useState('')
  const [monthFormat, setMonthFormat] = useState('numeric') // 'numeric' | 'chinese'
  const [selectedMonths, setSelectedMonths] = useState([])

  // ── 衍生的月份標籤（依格式決定）────────────────────────────────────────────
  const monthLabels = monthFormat === 'numeric' ? MONTHS_NUMERIC : MONTHS_CHINESE

  // ── 驗證是否可匯出 ────────────────────────────────────────────────────────
  const requiredIdentityFilled = IDENTITY_FIELDS
    .filter((f) => f.required)
    .every((f) => identityMapping[f.key] !== '')

  const canExport = requiredIdentityFilled && selectedMonths.length > 0

  // ── 切換月份 checkbox ──────────────────────────────────────────────────────
  function toggleMonth(label) {
    setSelectedMonths((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    )
  }

  // 將 selectedMonths UI 標籤轉為範本中文月份名稱
  const selectedMonthsInTemplateFmt = selectedMonths.map((label) => {
    if (monthFormat === 'numeric') {
      const idx = MONTHS_NUMERIC.indexOf(label)
      return idx >= 0 ? MONTHS_CHINESE[idx] : label
    }
    return label
  })

  // ── 建構 monthValueMapping ─────────────────────────────────────────────────
  function buildMonthValueMapping() {
    if (monthFormat === 'chinese') {
      return Object.fromEntries(MONTHS_CHINESE.map((c) => [c, c]))
    } else {
      return Object.fromEntries(MONTHS_NUMERIC.map((n, i) => [n, MONTHS_CHINESE[i]]))
    }
  }

  // ── 匯出 ──────────────────────────────────────────────────────────────────
  function handleExport() {
    const mappingConfig = {
      identityMapping,
      salaryMapping,
      monthSourceColumn,
      monthValueMapping: buildMonthValueMapping(),
      selectedMonths: selectedMonthsInTemplateFmt,
    }
    onExport(mappingConfig)
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>設定欄位對應</h1>
        <p className={styles.subheading}>
          將您的來源欄位對應到薪資印領清冊的各項目
        </p>
      </div>

      <div className={styles.layout}>
        {/* ── 左欄：對應表單 ─────────────────────────────────────────────── */}
        <div className={styles.formPanel}>

          {/* ── 區塊 A：身份欄位對應 ─────────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>🪪</span>
              身份識別欄位對應
            </div>

            {IDENTITY_FIELDS.map((field) => (
              <div key={field.key} className={styles.mappingRow}>
                <div className={styles.rowLabel}>
                  {field.key}
                  {field.required && <span className={styles.required}> *</span>}
                </div>
                <ColumnSelect
                  value={identityMapping[field.key]}
                  onChange={(val) =>
                    setIdentityMapping((prev) => ({ ...prev, [field.key]: val }))
                  }
                  sourceHeaders={sourceHeaders}
                  placeholder={field.required ? '— 必填，請選擇 —' : '— 請選擇欄位（可選）—'}
                />
              </div>
            ))}
          </div>

          {/* ── 區塊 B：薪資項目對應 ─────────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>💰</span>
              薪資項目對應
            </div>

            {SALARY_FIELDS_ENABLED.map((field) => (
              <div key={field} className={styles.mappingRow}>
                <div className={styles.rowLabel}>{field}</div>
                <ColumnSelect
                  value={salaryMapping[field]}
                  onChange={(val) =>
                    setSalaryMapping((prev) => ({ ...prev, [field]: val }))
                  }
                  sourceHeaders={sourceHeaders}
                />
              </div>
            ))}

            {SALARY_FIELDS_DISABLED.map((field) => (
              <div key={field} className={styles.mappingRow}>
                <div className={styles.rowLabel}>{field}</div>
                <div className={styles.disabledBadge}>暫不支援</div>
              </div>
            ))}
          </div>

          {/* ── 區塊 C：月份設定 ──────────────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>📅</span>
              月份設定
            </div>

            <div className={styles.monthSourceRow}>
              <div className={styles.monthLabel}>月份來源欄：</div>
              <ColumnSelect
                value={monthSourceColumn}
                onChange={setMonthSourceColumn}
                sourceHeaders={sourceHeaders}
                placeholder="— 選擇代表月份的欄位 —"
              />
            </div>

            <div className={styles.radioGroup}>
              <span className={styles.radioGroupLabel}>月份格式：</span>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="monthFormat"
                  value="numeric"
                  checked={monthFormat === 'numeric'}
                  onChange={() => {
                    setMonthFormat('numeric')
                    setSelectedMonths([])
                  }}
                />
                數字（1, 2, 3 … 12）
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="monthFormat"
                  value="chinese"
                  checked={monthFormat === 'chinese'}
                  onChange={() => {
                    setMonthFormat('chinese')
                    setSelectedMonths([])
                  }}
                />
                中文（一月, 二月 …）
              </label>
            </div>

            <div className={styles.monthGridLabel}>選擇本次填入的月份：</div>
            <div className={styles.monthGrid}>
              {monthLabels.map((label, idx) => {
                const isChecked = selectedMonths.includes(label)
                const isFilled = filledMonths.includes(label) ||
                  filledMonths.includes(MONTHS_CHINESE[idx]) ||
                  filledMonths.includes(MONTHS_NUMERIC[idx])

                let cellClass = styles.monthCheckbox
                if (isChecked && isFilled) cellClass += ' ' + styles.monthCheckboxCheckedFilled
                else if (isChecked) cellClass += ' ' + styles.monthCheckboxChecked
                else if (isFilled) cellClass += ' ' + styles.monthCheckboxFilled

                return (
                  <div key={label} className={styles.monthCell}>
                    <label className={cellClass}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMonth(label)}
                      />
                      {label}
                    </label>
                    {isFilled && (
                      <span className={styles.filledBadge}>已有資料</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 按鈕列 ───────────────────────────────────────────────────── */}
          <div className={styles.actions}>
            <button className={styles.backBtn} onClick={onBack}>
              ← 重新上傳
            </button>
            <button
              className={styles.exportBtn}
              disabled={!canExport}
              onClick={handleExport}
              title={!canExport ? '請完成必填欄位並至少選擇一個月份' : ''}
            >
              填入並下載 ↓
            </button>
          </div>
        </div>

        {/* ── 右欄：即時預覽 ─────────────────────────────────────────────── */}
        <div className={styles.previewPanel}>
          <MappingPreview
            templateWorkbook={templateWorkbook}
            templateStructure={templateStructure}
            sourceRows={sourceRows}
            identityMapping={identityMapping}
            salaryMapping={salaryMapping}
            selectedMonths={selectedMonthsInTemplateFmt}
            monthSourceColumn={monthSourceColumn}
            monthFormat={monthFormat}
          />
        </div>
      </div>
    </div>
  )
}
