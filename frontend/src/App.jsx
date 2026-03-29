import { useEffect } from 'react'
import { useRouter } from './context/RouterContext'
import Navbar from './components/Navbar'
import NewsTicker from './components/NewsTicker'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import JobsPage from './pages/JobsPage'
import NewsPage from './pages/NewsPage'
import AffiliatesPage from './pages/AffiliatesPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import SavedJobsPage from './pages/SavedJobsPage'
import AdminPanel from './pages/AdminPanel'
import AuthCallbackPage from './pages/AuthCallbackPage'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'

export default function App() {
  const { page, navigate } = useRouter()

  // Detect OAuth callback URL on first load.
  // Only redirect to auth/callback when we have a real OAuth code param
  // (i.e. the key is exactly "code" not something like "barcode").
  useEffect(() => {
    const path   = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    const hash   = window.location.hash

    // PKCE: Supabase puts ?code=<value> with no other ambiguous params
    const hasOAuthCode  = params.has('code') && params.has('state')  // PKCE flow always has both
    // Implicit / magic-link: #access_token in hash
    const hasHashToken  = hash.includes('access_token=')

    if (path === '/auth/callback' || hasOAuthCode || hasHashToken) {
      navigate('auth/callback')
    }
  }, [])  // eslint-disable-line

  const renderPage = () => {
    switch (page) {
      case 'home':           return <HomePage />
      case 'govt-jobs':      return <JobsPage category="govt" />
      case 'private-jobs':   return <JobsPage category="private" />
      case 'news':           return <NewsPage />
      case 'affiliates':     return <AffiliatesPage />
      case 'login':          return <LoginPage />
      case 'signup':         return <SignupPage />
      case 'saved-jobs':     return <SavedJobsPage />
      case 'admin':          return <ProtectedAdminRoute><AdminPanel /></ProtectedAdminRoute>
      case 'auth/callback':  return <AuthCallbackPage />
      default:               return <HomePage />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <NewsTicker />
      <main style={{ flex: 1 }}>{renderPage()}</main>
      {!['login', 'signup', 'admin', 'auth/callback'].includes(page) && <Footer />}
    </div>
  )
}
