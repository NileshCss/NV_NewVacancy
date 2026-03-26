import { createContext, useContext, useEffect, useState } from 'react'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('nv-theme') !== 'light' }
    catch { return true }
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.remove('day')
      root.classList.add('night')
      root.className = root.className
        .replace('day-mode','').trim() + ' night-mode'
    } else {
      root.classList.remove('night')
      root.classList.add('day')
      root.className = root.className
        .replace('night-mode','').trim() + ' day-mode'
    }
    try { localStorage.setItem('nv-theme', isDark ? 'dark' : 'light') }
    catch {}
  }, [isDark])

  return (
    <ThemeCtx.Provider value={{ isDark, toggle: () => setIsDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
