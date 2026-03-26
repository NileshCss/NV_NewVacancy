import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
      <span className="theme-mode-label">
        {isDark ? '🌙 Night' : '☀️ Day'}
      </span>
      <button
        className="theme-toggle-btn"
        onClick={toggle}
        title={isDark ? 'Switch to Day mode' : 'Switch to Night mode'}
        aria-label="Toggle theme"
      >
        <div className="toggle-track">
          <div className="toggle-stars">
            <div className="toggle-star"/>
            <div className="toggle-star"/>
            <div className="toggle-star"/>
          </div>
          <div className="toggle-clouds">
            <div className="toggle-cloud"/>
            <div className="toggle-cloud"/>
          </div>
          <div className="toggle-thumb">
            {isDark ? '🌙' : '☀️'}
          </div>
        </div>
      </button>
    </div>
  )
}
