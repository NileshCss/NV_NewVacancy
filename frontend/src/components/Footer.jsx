import React from 'react'
import { useRouter } from '../context/RouterContext'

export default function Footer() {
  const { navigate } = useRouter()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">
              <div className="logo-box">NV</div>
              <div className="logo-text"><span>New_</span><span>vacancy</span></div>
            </div>
            <div className="footer-desc">India's trusted job portal for Govt & Private jobs. Daily updates on SSC, UPSC, Railway, Banking, IT and more.</div>
          </div>
          <div>
            <div className="footer-col-title">Govt Jobs</div>
            <div className="footer-links">
              {['SSC Jobs', 'UPSC Jobs', 'Railway Jobs', 'Banking Jobs', 'Police Jobs', 'Teaching Jobs'].map(l => (
                <span key={l} className="footer-link" onClick={() => navigate('govt-jobs')}>{l}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-col-title">Private Jobs</div>
            <div className="footer-links">
              {['IT Jobs', 'Software Jobs', 'Finance Jobs', 'HR Jobs', 'Marketing Jobs', 'Remote Jobs'].map(l => (
                <span key={l} className="footer-link" onClick={() => navigate('private-jobs')}>{l}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-col-title">Resources</div>
            <div className="footer-links">
              {['Latest News', 'Offers & Deals', 'Exam Prep', 'Resume Tips', 'Interview Guide', 'About NV'].map(l => (
                <span key={l} className="footer-link">{l}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© 2026 New_vacancy (NV). Made in India 🇮🇳</div>
          <div className="footer-badge">⚡ Founder Nilesh Singh</div>
        </div>
      </div>
    </footer>
  )
}
