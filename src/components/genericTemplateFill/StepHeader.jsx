import styles from './StepHeader.module.css'

/**
 * 四步驟流程指示器。
 * @param {Array}    props.steps       [{ key, label }]
 * @param {number}   props.currentIndex
 * @param {number}   props.maxReachableIndex  可點擊跳轉的最大步驟（已完成的步驟可回頭）
 * @param {Function} props.onStepClick        (index) => void
 */
export default function StepHeader({ steps, currentIndex, maxReachableIndex, onStepClick }) {
  return (
    <ol className={styles.stepList}>
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex
        const isDone = i < currentIndex
        const isClickable = i <= maxReachableIndex && !isCurrent
        return (
          <li key={step.key} className={styles.stepItem}>
            <button
              type="button"
              className={`${styles.stepButton} ${isCurrent ? styles.stepCurrent : ''} ${isDone ? styles.stepDone : ''}`}
              disabled={!isClickable}
              onClick={() => onStepClick(i)}
            >
              <span className={styles.stepNumber}>{isDone ? '✓' : i + 1}</span>
              <span className={styles.stepLabel}>{step.label}</span>
            </button>
            {i < steps.length - 1 && <span className={styles.stepDivider} />}
          </li>
        )
      })}
    </ol>
  )
}
