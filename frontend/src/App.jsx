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

export default function App() {
  const { page } = useRouter()
  const renderPage = () => {
    switch (page) {
      case 'home':         return <HomePage />
      case 'govt-jobs':    return <JobsPage category="govt" />
      case 'private-jobs': return <JobsPage category="private" />
      case 'news':         return <NewsPage />
      case 'affiliates':   return <AffiliatesPage />
      case 'login':        return <LoginPage />
      case 'signup':       return <SignupPage />
      case 'saved-jobs':   return <SavedJobsPage />
      case 'admin':        return <AdminPanel />
      default:             return <HomePage />
    }
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Navbar />
      <NewsTicker />
      <main style={{ flex:1 }}>{renderPage()}</main>
      {!['login','signup','admin'].includes(page) && <Footer />}
    </div>
  )
}
