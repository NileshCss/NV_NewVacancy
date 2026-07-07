import React, { useState, useEffect } from 'react'

export default function AdminScraper() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchStats()
    fetchLogs()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/dashboard/stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nv_session')}` }
      })
      const data = await res.json()
      if (data.success) setStats(data.data)
    } catch (err) {}
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/admin/scrape-logs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nv_session')}` }
      })
      const data = await res.json()
      if (data.success) setLogs(data.data)
    } catch (err) {}
    setLoading(false)
  }

  const triggerScraper = async () => {
    try {
      alert('Triggering manual scraper run. This happens in the background.')
      await fetch('http://localhost:5000/api/admin/scraper/trigger', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nv_session')}` }
      })
      fetchLogs()
    } catch (err) {}
  }

  return (
    <div>
      <div className="admin-header">
        <div className="admin-title">🤖 AI Scraper Panel</div>
        <button className="btn btn-primary btn-sm" onClick={triggerScraper}>▶️ Run Scraper Now</button>
      </div>

      <div className="admin-cards" style={{ marginBottom: '2rem' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📥</div>
          <div className="admin-stat-val">{stats?.scraped_jobs_today || 0}</div>
          <div className="admin-stat-label">Jobs Scraped Today</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🚩</div>
          <div className="admin-stat-val">{stats?.flagged_jobs || 0}</div>
          <div className="admin-stat-label">Flagged Jobs</div>
        </div>
      </div>

      <div className="admin-table-wrap">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Recent Scrape Runs</div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Status</th>
              <th>Added</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5">Loading...</td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.started_at).toLocaleString()}</td>
                <td>{log.source}</td>
                <td>
                  <span className={`badge badge-${log.status === 'success' ? 'green' : 'red'}`}>
                    {log.status}
                  </span>
                </td>
                <td>{log.jobs_added}</td>
                <td style={{ color: 'var(--red)' }}>{log.error_message || '-'}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No recent logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
