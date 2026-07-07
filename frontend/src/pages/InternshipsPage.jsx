import { useState, useEffect } from 'react'
import { useRouter } from '../context/RouterContext'
import JobCard from '../components/JobCard'

export default function InternshipsPage() {
  const { navigate } = useRouter()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchInternships()
  }, [page])

  const fetchInternships = async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/jobs?internship=true&page=${page}&limit=20`)
      const data = await res.json()
      if (data.success) {
        setJobs(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch internships:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrap anim-fade">
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div className="container">
          <h1>🎓 Internships</h1>
          <p>Kickstart your career with the best internship opportunities for freshers and students.</p>
          <div className="job-count-tag">{jobs.length} Internships available</div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* CONTENT */}
        {loading ? (
          <div className="jobs-grid">
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 320 }} />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎒</div>
            <h3 className="empty-title">No internships found</h3>
            <p className="empty-text">Check back later for new internship openings.</p>
          </div>
        ) : (
          <div className="jobs-grid">
            {jobs.map((job, idx) => (
              <div key={job.id} className="job-card anim-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="job-card-body">
                  <div className="job-cat-tag govt" style={{ background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.2)', color: '#d8b4fe' }}>
                    <div className="job-cat-dot" style={{ background: '#d8b4fe' }} />
                    Internship
                  </div>
                  <h3 className="job-title" onClick={() => navigate(`jobs/${job.slug}`)}>
                    {job.title}
                  </h3>
                  <div className="job-org">
                    🏢 {job.organization}
                  </div>
                  
                  <div className="job-meta">
                    <div className="job-meta-item">📍 {job.location || 'Remote'}</div>
                    <div className="job-meta-item">💰 {job.salary_range || 'Unpaid / Stipend based'}</div>
                  </div>

                  <div className="job-tags">
                    {job.skills?.slice(0, 3).map(s => <span key={s} className="job-tag">{s}</span>)}
                    {job.skills?.length > 3 && <span className="job-tag">+{job.skills.length - 3}</span>}
                  </div>

                  <div className="job-spacer" />
                  
                  <div className="job-actions">
                    <button className="job-apply-btn" onClick={() => navigate(`jobs/${job.slug}`)}>
                      Apply Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
