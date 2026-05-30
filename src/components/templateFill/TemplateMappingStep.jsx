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
  // 自動偵測月份欄（優先「來源分頁」，其次「月份」，其次讓使用者自選）
  const autoMonthCol = sourceHeaders.includes('來源分頁') ? '來源分頁'
    : sourceHeaders.includes('月份') ? '月份'
    : ''
  const [monthSourceColumn, setMonthSourceColumn] = useState(autoMonthCol)

  // 從月份欄取出所有不重複的值（即 sheet 名稱或月份名稱）
  const uniqueMonthValues = monthSourceColumn
    ? [...new Set(sourceRows.map(r => String(r[monthSourceColumn] ?? '')).filter(v => v))]
    : []

  // 每個模板月份（一月～十二月）對應到哪個來源值
  const [monthMapping, setMonthMapping] = useState(() => {
    const m = {}
    for (const tm of MONTHS_CHINESE) m[tm] = ''
    return m
  })

  // ── 驗證是否可匯出 ────────────────────────────────────────────────────────
  const requiredIdentityFilled = IDENTITY_FIELDS
    .filter((f) => f.required)
    .every((f) => identityMapping[f.key] !== '')

  const selectedMonthsInTemplateFmt = MONTHS_CHINESE.filter(m => monthMapping[m])
  const canExport = requiredIdentityFilled && selectedMonthsInTemplateFmt.length > 0

  // ── 建構 monthValueMapping ─────────────────────────────────────────────────
  function buildMonthValueMapping() {
    return Object.fromEntries(
      MONTHS_CHINESE
        .filter(tm => monthMapping[tm])
        .map(tm => [monthMapping[tm], tm])
    )
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

            {/* 月份欄非自動偵測時，讓使用者手動選 */}
            {!autoMonthCol && (
              <div className={styles.monthSourceRow}>
                <div className={styles.monthLabel}>月份來源欄：</div>
                <ColumnSelect
                  value={monthSourceColumn}
                  onChange={setMonthSourceColumn}
                  sourceHeaders={sourceHeaders}
                  placeholder="— 選擇代表月份的欄位 —"
                />
              </div>
            )}

            {monthSourceColumn && uniqueMonthValues.length === 0 && (
              <div className={styles.monthHint}>找不到月份資料，請確認欄位是否正確。</div>
            )}

            {monthSourceColumn && uniqueMonthValues.length > 0 && (
              <>
                {autoMonthCol && (
                  <div className={styles.monthHint}>
                    自動偵測月份欄：<strong>{monthSourceColumn}</strong>，
                    選項為上傳檔案的工作表名稱，不可修改。
                  </div>
                )}
                <div className={styles.monthGridLabel}>
                  為每個月份選擇對應的工作表（未選擇的月份不填入）：
                </div>
                <div className={styles.monthMapGrid}>
                  {MONTHS_CHINESE.map((tm, idx) => {
                    const isFilled = filledMonths.includes(tm)
                    return (
                      <div key={tm} className={styles.monthMapRow}>
                        <span className={`${styles.templateMonth} ${isFilled ? styles.templateMonthFilled : ''}`}>
                          {tm}
                          {isFilled && <span className={styles.filledBadge}>已有資料</span>}
                        </span>
                        <span className={styles.monthArrow}>←</span>
                        <select
                          className={styles.monthSelect}
                          value={monthMapping[tm]}
                          onChange={e => setMonthMapping(prev => ({ ...prev, [tm]: e.target.value }))}
                        >
                          <option value="">（不填）</option>
                          {uniqueMonthValues.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {!monthSourceColumn && (
              <div className={styles.monthHint}>
                找不到月份欄位。請確認來源檔案有「來源分頁」或「月份」欄。
              </div>
            )}
          </div>

          {/* ── 按鈕列 ───────────────────────────────────────────────────── */}
          <div className={styles.actions}>
            <button className={styles.backBtn} onClick={onBack}>
              ← 上一步
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
            monthValueMapping={buildMonthValueMapping()}
          />
        </div>
      </div>
    </div>
  )
}
