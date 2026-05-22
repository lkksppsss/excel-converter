import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo}>⚡</span>
        <span className={styles.title}>Excel 智慧格式轉換工具</span>
      </div>
      <nav className={styles.nav}>
        <span className={styles.tagline}>台灣會計事務所首選</span>
      </nav>
    </header>
  )
}
