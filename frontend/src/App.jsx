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
import ProtectedRoute from './components/ProtectedRoute'
import SmartMatchPage   from './pages/SmartMatchPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfileCompletionModal from './components/auth/ProfileCompletionModal'
import WalkinsPage        from './pages/WalkinsPage'
import InternshipsPage    from './pages/InternshipsPage'
import CompanyDirectoryPage from './pages/CompanyDirectoryPage'
import AssistantPage      from './pages/AssistantPage'
import JobDetailPage      from './pages/JobDetailPage'
import ExamDirectory      from './pages/exam/ExamDirectory'
import ExamLandingPage    from './pages/exam/ExamLandingPage'
import MockTestList       from './pages/exam/MockTestList'
import MockTestPlayer     from './pages/exam/MockTestPlayer'
import MockTestResult     from './pages/exam/MockTestResult'


// Pages that don't show the Footer
const NO_FOOTER_PAGES = new Set(['login', 'signup', 'admin', 'auth/callback', 'reset-password'])

export default function App() {
  const { page, navigate } = useRouter()
  const { initialized, loading, isRecoverySession } = useAuth()

  // Top-level recovery guard: whenever Supabase fires a PASSWORD_RECOVERY event,
  // AuthContext sets isRecoverySession=true. Immediately navigate to the
  // Set New Password screen regardless of what page the user landed on.
  useEffect(() => {
    if (isRecoverySession) {
      navigate('reset-password')
    }
  }, [isRecoverySession, navigate])

  // Detect OAuth / magic-link / password-reset redirect on first load
  useEffect(() => {
    const path   = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    const hash   = window.location.hash

    const hasOAuthCode  = params.has('code') && params.has('state')  // PKCE (Google OAuth)
    const hasHashToken  = hash.includes('access_token=')
    // Password recovery links include type=recovery in the hash
    const isRecovery    = hash.includes('type=recovery') || params.get('type') === 'recovery'

    if (isRecovery) {
      // Go straight to reset-password page — AuthCallbackPage will pick up the token
      navigate('auth/callback')
      return
    }

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
      case 'internships':   return <InternshipsPage />
      case 'walk-ins':      return <WalkinsPage />
      case 'companies':     return <CompanyDirectoryPage />
      case 'assistant':     return <AssistantPage />
      case 'news':          return <NewsPage />
      case 'affiliates':    return <ProtectedRoute><AffiliatesPage /></ProtectedRoute>
      case 'login':         return <LoginPage />
      case 'signup':        return <SignupPage />
      case 'saved-jobs':    return <SavedJobsPage />
      case 'smartmatch':    return <ProtectedRoute><SmartMatchPage /></ProtectedRoute>
      case 'admin':         return <ProtectedAdminRoute><AdminPanel /></ProtectedAdminRoute>
      case 'auth/callback': return <AuthCallbackPage />
      case 'reset-password': return <ResetPasswordPage />
      case 'exams':          return <ExamDirectory />
      case 'mock-tests':     return <ProtectedRoute><MockTestList /></ProtectedRoute>
      default: 
        if (page.startsWith('jobs/')) return <JobDetailPage />
        if (page.startsWith('exams/')) return <ExamLandingPage />
        if (page.startsWith('mock-tests/take/')) return <ProtectedRoute><MockTestPlayer /></ProtectedRoute>
        if (page.startsWith('mock-tests/result/')) return <ProtectedRoute><MockTestResult /></ProtectedRoute>
        return <HomePage />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <NewsTicker />
      <main style={{ flex: 1 }}>{renderPage()}</main>
      {!NO_FOOTER_PAGES.has(page) && <Footer />}
      <ProfileCompletionModal />
    </div>
  )
}
