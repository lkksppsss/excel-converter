import styles from './SheetTabs.module.css'

export default function SheetTabs({ sheetNames, activeSheet, onSelect }) {
  if (sheetNames.length <= 1) return null
  return (
    <div className={styles.tabs}>
      {sheetNames.map((name) => (
        <button
          key={name}
          type="button"
          className={`${styles.tab} ${name === activeSheet ? styles.tabActive : ''}`}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
