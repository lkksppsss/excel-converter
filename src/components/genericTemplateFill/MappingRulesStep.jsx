import { useState } from 'react'
import { describeCondition } from '../../utils/genericTemplateFill/fillEngine'
import styles from './MappingRulesStep.module.css'

let ruleIdCounter = 0
function nextRuleId() {
  ruleIdCounter += 1
  return `rule-${ruleIdCounter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 步驟 3：建立「來源欄位 → 填入區」的對應規則，可加上篩選條件。
 *
 * 條件種類（見 docs/project-spec.md 篩選條件規則 A + C）：
 * - none         ：全部資料列依序填入
 * - column-value ：來源欄位等於某值的列才填入（例：「月份」= 1 → 填 B4:B15）
 * - sheet-name   ：只取某個來源工作表的資料（例：工作表「1月」→ 填 B4:B15）
 */
export default function MappingRulesStep({
  sourceFields,
  sourceSheetNames,
  allowSheetCondition,
  fillZones,
  rules,
  onRulesChange,
  onNext,
  onBack,
}) {
  const fieldNames = sourceFields.map((f) => f.name)
  const [sourceField, setSourceField] = useState(fieldNames[0] || '')
  const [targetZoneId, setTargetZoneId] = useState(fillZones[0]?.id || '')
  const [condType, setCondType] = useState('none')
  const [condColumn, setCondColumn] = useState(fieldNames[0] || '')
  const [condValue, setCondValue] = useState('')
  const [condSheet, setCondSheet] = useState(sourceSheetNames[0] || '')
  const [formError, setFormError] = useState('')

  const zoneById = new Map(fillZones.map((z) => [z.id, z]))

  function buildCondition() {
    if (condType === 'column-value') {
      if (!condValue.trim()) return { error: '請輸入條件值' }
      return { condition: { type: 'column-value', column: condColumn, value: condValue.trim() } }
    }
    if (condType === 'sheet-name') {
      return { condition: { type: 'sheet-name', sheetName: condSheet } }
    }
    return { condition: null }
  }

  function handleAddRule() {
    if (!sourceField || !targetZoneId) {
      setFormError('請選擇來源欄位與填入區')
      return
    }
    const { condition, error } = buildCondition()
    if (error) {
      setFormError(error)
      return
    }
    onRulesChange([...rules, { id: nextRuleId(), sourceField, targetZoneId, condition }])
    setCondValue('')
    setFormError('')
  }

  function handleRemoveRule(id) {
    onRulesChange(rules.filter((r) => r.id !== id))
  }

  return (
    <div className={styles.step}>
      <h2 className={styles.title}>步驟 3：設定對應規則</h2>
      <p className={styles.desc}>
        指定來源欄位的資料要填入哪個填入區。同一個欄位搭配不同條件可填入不同區域
        （例如「月份」= 1 填 1 月的欄、「月份」= 2 填 2 月的欄）
      </p>

      <div className={styles.builder}>
        <div className={styles.builderRow}>
          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>來源欄位</span>
            <select
              className={styles.select}
              value={sourceField}
              onChange={(e) => setSourceField(e.target.value)}
            >
              {fieldNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <span className={styles.arrow}>→</span>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>目標填入區</span>
            <select
              className={styles.select}
              value={targetZoneId}
              onChange={(e) => setTargetZoneId(e.target.value)}
            >
              {fillZones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}（{z.range}）</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.builderRow}>
          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>篩選條件</span>
            <select
              className={styles.select}
              value={condType}
              onChange={(e) => setCondType(e.target.value)}
            >
              <option value="none">無（全部資料）</option>
              <option value="column-value">欄位等於某值</option>
              {allowSheetCondition && <option value="sheet-name">來源工作表名稱</option>}
            </select>
          </label>

          {condType === 'column-value' && (
            <>
              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>條件欄位</span>
                <select
                  className={styles.select}
                  value={condColumn}
                  onChange={(e) => setCondColumn(e.target.value)}
                >
                  {fieldNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>等於</span>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="例如：1"
                  value={condValue}
                  onChange={(e) => setCondValue(e.target.value)}
                />
              </label>
            </>
          )}

          {condType === 'sheet-name' && (
            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>工作表</span>
              <select
                className={styles.select}
                value={condSheet}
                onChange={(e) => setCondSheet(e.target.value)}
              >
                {sourceSheetNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          )}

          <button type="button" className={styles.addButton} onClick={handleAddRule}>
            ＋ 新增規則
          </button>
          {formError && <span className={styles.formError}>{formError}</span>}
        </div>
      </div>

      {rules.length > 0 ? (
        <table className={styles.ruleTable}>
          <thead>
            <tr>
              <th>來源欄位</th>
              <th>目標填入區</th>
              <th>篩選條件</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const zone = zoneById.get(rule.targetZoneId)
              return (
                <tr key={rule.id}>
                  <td>{rule.sourceField}</td>
                  <td>{zone ? `${zone.name}（${zone.range}）` : '（填入區已刪除）'}</td>
                  <td>{describeCondition(rule.condition)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => handleRemoveRule(rule.id)}
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className={styles.emptyHint}>尚未建立任何規則</div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          ← 上一步
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={rules.length === 0}
          onClick={onNext}
        >
          {rules.length > 0 ? '下一步：預覽結果 →' : '請先新增至少一條規則'}
        </button>
      </div>
    </div>
  )
}
