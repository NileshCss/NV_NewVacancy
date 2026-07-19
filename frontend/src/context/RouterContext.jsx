import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const RouterCtx = createContext(null)

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

// All valid single-segment routes. Unknown paths fall back to 'home'.
const KNOWN_PAGES = new Set([
  'home', 'govt-jobs', 'private-jobs', 'internships', 'walk-ins',
  'companies', 'assistant', 'news', 'affiliates', 'login', 'signup',
  'saved-jobs', 'smartmatch', 'admin', 'reset-password', 'exams', 'mock-tests',
  'auth/callback', 'auth/reset-password',
])

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Map a URL pathname → internal page key.
 * Returns 'home' for unknown paths so the app never hard-crashes.
 */
function pathnameToPage(pathname) {
  const p = pathname.replace(/^\//, '').replace(/\/$/, '') // strip leading/trailing slashes
  if (!p) return 'home'

  // Known multi-segment prefixes
  if (p.startsWith('jobs/'))              return p  // e.g. jobs/abc-123
  if (p.startsWith('exams/'))             return p
  if (p.startsWith('mock-tests/take/'))   return p
  if (p.startsWith('mock-tests/result/')) return p
  if (p.startsWith('auth/'))              return p  // auth/callback, auth/reset-password

  return KNOWN_PAGES.has(p) ? p : 'home'
}

/**
 * Map an internal page key → URL pathname.
 * Most pages map trivially; 'home' → '/'.
 */
function pageToPathname(page) {
  if (!page || page === 'home') return '/'
  return '/' + page
}

/**
 * Read the initial page from the current URL on app mount.
 * Captures referral codes and normalises the URL via replaceState
 * (not pushState — that would pollute history with a duplicate entry).
 */
function getInitialPage() {
  if (typeof window === 'undefined') return 'home'

  const params = new URLSearchParams(window.location.search)

  // Persist referral code across navigation
  const ref = params.get('ref')
  if (ref) {
    sessionStorage.setItem('nv_referral_code', ref.trim().toUpperCase())
  }

  const page = pathnameToPage(window.location.pathname)

  // Normalise the URL: if the browser has e.g. '/' but we resolve to 'home',
  // keep '/' — only replace if the canonical form differs (e.g. trailing slash).
  const canonical = pageToPathname(page)
  if (window.location.pathname !== canonical && page !== 'home') {
    // Use replaceState so we don't push a new history entry on initial load.
    window.history.replaceState({ page }, '', canonical + window.location.search + window.location.hash)
  }

  return page
}

// ─────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────

export function RouterProvider({ children }) {
  const [page, setPage] = useState(getInitialPage)

  /**
   * navigate(pageKey, { replace = false } = {})
   *
   * - Updates React state (re-renders the correct page component).
   * - Syncs window.location via pushState so F5 / deep-links work.
   * - Scrolls to top only on explicit user-initiated navigation
   *   (replace:true is used internally for auth redirects where we
   *   don't want an extra history entry but still want the URL to
   *   update — it also skips the scroll-to-top to avoid jarring jumps).
   */
  const navigate = useCallback((pageKey, { replace = false } = {}) => {
    const safePage = pathnameToPage(pageToPathname(pageKey)) // normalise
    setPage(safePage)

    const pathname = pageToPathname(safePage)
    if (replace) {
      window.history.replaceState({ page: safePage }, '', pathname)
    } else {
      window.history.pushState({ page: safePage }, '', pathname)
      // Only scroll to top on genuine forward navigation, not on restore.
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [])

  /**
   * Listen for browser Back / Forward button events.
   * popstate fires when the user presses Back/Forward.
   * We read the page from history.state (set by pushState above),
   * falling back to parsing window.location.pathname.
   */
  useEffect(() => {
    const onPopState = (e) => {
      const restoredPage = e.state?.page || pathnameToPage(window.location.pathname)
      setPage(restoredPage)
      // Do NOT scroll to top on Back/Forward — the browser restores scroll
      // position natively and we should not interfere.
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return (
    <RouterCtx.Provider value={{ page, navigate }}>
      {children}
    </RouterCtx.Provider>
  )
}

export const useRouter = () => useContext(RouterCtx)
