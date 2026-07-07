import { useState, useEffect } from 'react'
import { useRouter } from '../context/RouterContext'

export default function JobDetailPage() {
  const { page, navigate } = useRouter()
  // Extract slug from "jobs/:slug"
  const slug = page.split('/')[1]
  
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (slug) fetchJob()
  }, [slug])

  const fetchJob = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${slug}`)
      const data = await res.json()
      if (data.success && data.data) {
        setJob(data.data)
      } else {
        setError('Job not found')
      }
    } catch (err) {
      setError('Failed to fetch job details')
    } finally {
      setLoading(false)
    }
  }

  const trackApply = async () => {
    if (job?.id) {
      fetch(`http://localhost:5000/api/jobs/${job.id}/apply`, { method: 'POST' }).catch(() => {})
    }
    if (job?.apply_url) {
      window.open(job.apply_url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem' }}>
        <div className="skeleton" style={{ height: 400, borderRadius: 20 }} />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="empty-state">
        <div className="empty-icon">😢</div>
        <h3 className="empty-title">Job Not Found</h3>
        <p className="empty-text">This job may have been removed or the link is invalid.</p>
        <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '1rem' }}>
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div className="anim-fade" style={{ paddingBottom: '5rem' }}>
      {/* HEADER SECTION */}
      <div className="page-header" style={{ marginBottom: '2rem', padding: '3rem 0' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {job.is_walkin && <span className="badge badge-green">Walk-In</span>}
            {job.is_internship && <span className="badge" style={{ background: 'rgba(168,85,247,0.1)', color: '#d8b4fe' }}>Internship</span>}
            <span className="badge badge-blue">{job.category === 'govt' ? 'Government' : 'Private'}</span>
          </div>
          
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{job.title}</h1>
          <div style={{ fontSize: '1.2rem', color: 'var(--brand-l)', fontWeight: 600, paddingLeft: '0', margin: 0 }}>
            🏢 {job.organization}
          </div>
        </div>
      </div>

      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
        
        {/* MAIN CONTENT */}
        <div style={{ background: 'rgba(22,32,50,0.6)', border: '1px solid var(--white-8)', borderRadius: '20px', padding: '2rem' }}>
          
          {/* META GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem', background: 'var(--white-5)', padding: '1.5rem', borderRadius: '16px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--grey-5)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Location</div>
              <div style={{ fontWeight: 600 }}>📍 {job.location || 'Remote'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--grey-5)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Salary</div>
              <div style={{ fontWeight: 600, color: '#86efac' }}>💰 {job.salary_range || 'Not Disclosed'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--grey-5)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Experience</div>
              <div style={{ fontWeight: 600 }}>🎓 {job.qualification || 'Any Grad'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--grey-5)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Type</div>
              <div style={{ fontWeight: 600 }}>💼 {job.employment_type || 'Full Time'}</div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', borderBottom: '1px solid var(--white-8)', paddingBottom: '0.5rem' }}>
            Job Description
          </h3>
          <div style={{ lineHeight: 1.7, color: 'var(--grey-3)', marginBottom: '2.5rem', whiteSpace: 'pre-wrap' }}>
            {job.job_description || 'No detailed description provided. Please refer to the official application link for more details.'}
          </div>

          {/* SKILLS */}
          {job.skills?.length > 0 && (
            <>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', borderBottom: '1px solid var(--white-8)', paddingBottom: '0.5rem' }}>
                Required Skills
              </h3>
              <div className="tag-pills" style={{ marginBottom: '2.5rem' }}>
                {job.skills.map(s => <span key={s} className="tag-pill">{s}</span>)}
              </div>
            </>
          )}

          {/* APPLY BOTTOM */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <button className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }} onClick={trackApply}>
              Apply on Official Website ↗
            </button>
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--brand)', borderRadius: '16px', padding: '1.5rem', color: '#fff', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Interested?</h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem', color: 'rgba(255,255,255,0.9)' }}>
              Apply directly on the employer's website. We track applications to recommend better jobs!
            </p>
            <button className="btn" style={{ width: '100%', background: '#fff', color: 'var(--brand)', fontWeight: 800 }} onClick={trackApply}>
              Apply Now
            </button>
          </div>

          <div style={{ background: 'rgba(22,32,50,0.6)', border: '1px solid var(--white-8)', borderRadius: '16px', padding: '1.5rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--grey-4)', textTransform: 'uppercase' }}>Job Overview</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--grey-5)' }}>Posted</span>
                <span style={{ fontWeight: 600 }}>{new Date(job.posted_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--grey-5)' }}>Last Date</span>
                <span style={{ fontWeight: 600, color: 'var(--red)' }}>{job.last_date ? new Date(job.last_date).toLocaleDateString() : 'ASAP'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--grey-5)' }}>Batch</span>
                <span style={{ fontWeight: 600 }}>{job.batch_year || 'Any'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--grey-5)' }}>Work Mode</span>
                <span style={{ fontWeight: 600 }}>{job.work_mode || 'Office'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--grey-5)' }}>Views</span>
                <span style={{ fontWeight: 600 }}>{job.view_count || 1}</span>
              </div>
            </div>
          </div>
          
          {/* SEO JSON-LD injection */}
          {job.json_ld && (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(job.json_ld) }} />
          )}
        </div>
      </div>
    </div>
  )
}
