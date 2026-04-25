import { useEffect } from 'react'
import { useRouter } from './context/RouterContext'
import { useAuth }   from './context/AuthContext'
import Navbar    from './components/Navbar'
import NewsTicker from './components/NewsTicker'
import Footer    from './components/Footer'
import HomePage  from './pages/HomePage'
import JobsPage  from './pages/JobsPage'
import NewsPage  from './pages/NewsPage'
import AffiliatesPage   from './pages/AffiliatesPage'
import LoginPage        from './pages/LoginPage'
import SignupPage       from './pages/SignupPage'
import SavedJobsPage    from './pages/SavedJobsPage'
import AdminPanel       from './pages/AdminPanel'
import AuthCallbackPage from './pages/AuthCallbackPage'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'
import SmartMatchPage   from './pages/SmartMatchPage'

// Pages that don't show the Footer
const NO_FOOTER_PAGES = new Set(['login', 'signup', 'admin', 'auth/callback'])

export default function App() {
  const { page, navigate } = useRouter()
  const { initialized, loading } = useAuth()

  // Detect OAuth / magic-link redirect on first load
  useEffect(() => {
    const path   = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    const hash   = window.location.hash

    const hasOAuthCode = params.has('code') && params.has('state')  // PKCE always has both
    const hasHashToken = hash.includes('access_token=')

    if (path === '/auth/callback' || hasOAuthCode || hasHashToken) {
      navigate('auth/callback')
    }
  }, [navigate])

  // Show loading screen until auth is initialized
  if (!initialized || loading) {
    return (
      <div
        style={{
          minHeight:       '100vh',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexDirection:   'column',
          gap:             '0.75rem',
          background:      'var(--bg-base)',
        }}
      >
        <div
          style={{
            width:           44,
            height:          44,
            border:          '3px solid var(--brand)',
            borderTopColor:  'transparent',
            borderRadius:    '50%',
            animation:       'spin 0.8s linear infinite',
          }}
        />
        <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
          Loading secure session...
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (page) {
      case 'home':          return <HomePage />
      case 'govt-jobs':     return <JobsPage category="govt" />
      case 'private-jobs':  return <JobsPage category="private" />
      case 'news':          return <NewsPage />
      case 'affiliates':    return <AffiliatesPage />
      case 'login':         return <LoginPage />
      case 'signup':        return <SignupPage />
      case 'saved-jobs':    return <SavedJobsPage />
      case 'smartmatch':    return <SmartMatchPage />
      case 'admin':         return <ProtectedAdminRoute><AdminPanel /></ProtectedAdminRoute>
      case 'auth/callback': return <AuthCallbackPage />
      default:              return <HomePage />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <NewsTicker />
      <main style={{ flex: 1 }}>{renderPage()}</main>
      {!NO_FOOTER_PAGES.has(page) && <Footer />}
    </div>
  )
}
