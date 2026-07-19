import { createContext, useContext, useState, useCallback } from 'react'

const RouterCtx = createContext(null)

// Map URL pathnames to internal page keys
function pathnameToPage(pathname) {
  const p = pathname.replace(/^\//, '').replace(/\/$/, '') // strip leading/trailing slashes
  if (!p) return 'home'

  // Known multi-segment prefixes
  if (p.startsWith('jobs/'))              return p  // e.g. jobs/abc-123
  if (p.startsWith('exams/'))             return p
  if (p.startsWith('mock-tests/take/'))   return p
  if (p.startsWith('mock-tests/result/')) return p
  if (p.startsWith('auth/'))             return p  // auth/callback

  // Known single-segment routes
  const known = new Set([
    'home', 'govt-jobs', 'private-jobs', 'internships', 'walk-ins',
    'companies', 'assistant', 'news', 'affiliates', 'login', 'signup',
    'saved-jobs', 'smartmatch', 'admin', 'reset-password', 'exams', 'mock-tests',
  ])
  return known.has(p) ? p : 'home'
}

function getInitialPage() {
  if (typeof window === 'undefined') return 'home'
  const params = new URLSearchParams(window.location.search)

  // Capture referral code from URL and persist it across navigation
  const ref = params.get('ref')
  if (ref) {
    sessionStorage.setItem('nv_referral_code', ref.trim().toUpperCase())
  }

  return pathnameToPage(window.location.pathname)
}

export function RouterProvider({ children }) {
  const [page, setPage] = useState(getInitialPage)

  const navigate = useCallback((p) => {
    setPage(p)
    window.scrollTo(0, 0)
  }, [])

  return (
    <RouterCtx.Provider value={{ page, navigate }}>
      {children}
    </RouterCtx.Provider>
  )
}

export const useRouter = () => useContext(RouterCtx)
