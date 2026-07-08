import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../services/supabase'

// ── Helper: get API base with guaranteed /api suffix ──────────────────────────
const getApiBase = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  url = url.replace(/\/+$/, '')
  if (!url.endsWith('/api')) url += '/api'
  return url
}

// ── Helper: get current Supabase JWT ─────────────────────────────────────────
async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export default function AdminScraper() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats]     = useState(null)
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg]   = useState(null)  // { type: 'success'|'error', text }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const token   = await getToken()
      const apiBase = getApiBase()
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }

      // Fetch dashboard stats + scrape logs in parallel
      const [statsRes, logsRes] = await Promise.allSettled([
        fetch(`${apiBase}/admin/dashboard-stats`, { headers }),
        fetch(`${apiBase}/admin/scrape-logs`,     { headers }),
      ])

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const statsJson = await statsRes.value.json()
        if (statsJson.success) setStats(statsJson.data)
      }

      if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
        const logsJson = await logsRes.value.json()
        if (logsJson.success) setLogs(logsJson.data || [])
      }
    } catch (err) {
      console.error('[AdminScraper] fetchData error:', err.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 60s so new runs appear without manual reload
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const triggerScraper = async () => {
    if (running) return
    setRunning(true)
    setRunMsg(null)
    try {
      const token   = await getToken()
      const apiBase = getApiBase()
      const res = await fetch(`${apiBase}/admin/run-scrapers`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const json = await res.json()
      if (res.ok) {
        setRunMsg({ type: 'success', text: '✅ Scraper triggered! Logs will update automatically.' })
        // Refresh logs after 5s to pick up the new run entry
        setTimeout(fetchData, 5000)
      } else {
        setRunMsg({ type: 'error', text: `❌ ${json.error || 'Failed to trigger scraper'}` })
      }
    } catch (err) {
      setRunMsg({ type: 'error', text: `❌ Network error: ${err.message}` })
    }
    setRunning(false)
  }

  // Compute "scraped today" from logs
  const today       = new Date().toISOString().slice(0, 10)
  const scrapedToday = logs
    .filter(l => (l.run_at || '').startsWith(today))
    .reduce((sum, l) => sum + (l.jobs_inserted || 0), 0)

  const flaggedJobs = stats?.flagged_jobs ?? 0

  return (
    <div>
      {/* Header */}
      <div className="admin-header">
        <div className="admin-title">🤖 AI Scraper Panel</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh logs"
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={triggerScraper}
            disabled={running}
          >
            {running ? '⏳ Running…' : '▶️ Run Scraper Now'}
          </button>
        </div>
      </div>

      {/* Run result message */}
      {runMsg && (
        <div style={{
          margin: '0 0 16px',
          padding: '10px 16px',
          borderRadius: '10px',
          fontSize: '13px',
          background: runMsg.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${runMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: runMsg.type === 'success' ? '#4ade80' : '#f87171',
        }}>
          {runMsg.text}
        </div>
      )}

      {/* Stat cards */}
      <div className="admin-cards" style={{ marginBottom: '2rem' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📥</div>
          <div className="admin-stat-val">{loading ? '…' : scrapedToday}</div>
          <div className="admin-stat-label">Jobs Scraped Today</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🚩</div>
          <div className="admin-stat-val">{loading ? '…' : flaggedJobs}</div>
          <div className="admin-stat-label">Flagged Jobs</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🗂️</div>
          <div className="admin-stat-val">{loading ? '…' : logs.length}</div>
          <div className="admin-stat-label">Total Runs Logged</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">✅</div>
          <div className="admin-stat-val">
            {loading ? '…' : logs.reduce((s, l) => s + (l.jobs_inserted || 0), 0)}
          </div>
          <div className="admin-stat-label">Total Jobs Inserted</div>
        </div>
      </div>

      {/* Logs table */}
      <div className="admin-table-wrap">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Recent Scrape Runs</span>
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>
            Auto-refreshes every 60s
          </span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time (IST)</th>
              <th>Source</th>
              <th>Status</th>
              <th>Found</th>
              <th>Added</th>
              <th>Skipped</th>
              <th>Errors</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No scrape runs yet. Click <strong>Run Scraper Now</strong> to start the first run,
                  or wait for the hourly cron (runs at :05 past each hour IST).
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                    {new Date(log.run_at || log.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td>{log.source_name || log.source || '—'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                      background: log.status === 'success' ? 'rgba(34,197,94,0.15)'
                               : log.status === 'running'  ? 'rgba(234,179,8,0.15)'
                               : log.status === 'partial'  ? 'rgba(249,115,22,0.15)'
                               :                            'rgba(239,68,68,0.15)',
                      color: log.status === 'success' ? '#4ade80'
                           : log.status === 'running'  ? '#facc15'
                           : log.status === 'partial'  ? '#fb923c'
                           :                            '#f87171',
                    }}>
                      {log.status || 'unknown'}
                    </span>
                  </td>
                  <td>{log.jobs_found    ?? '—'}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>{log.jobs_inserted ?? '—'}</td>
                  <td>{log.jobs_skipped  ?? '—'}</td>
                  <td style={{ color: log.jobs_errors > 0 ? 'var(--red)' : 'inherit' }}>
                    {log.jobs_errors ?? log.error_message ?? '—'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.duration_ms ? `${Math.round(log.duration_ms / 1000)}s` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Why scraper might be empty */}
      {!loading && logs.length === 0 && (
        <div style={{
          marginTop: '16px', padding: '16px', borderRadius: '12px',
          background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)',
          fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7,
        }}>
          <strong>💡 Why is this empty?</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>The backend must be running on Render (<code>nv-backend-2bnp.onrender.com</code>) with <code>SCRAPER_ENABLED=true</code></li>
            <li>The hourly cron fires at :05 past each hour IST — check Render logs for <code>[ScrapeScheduler]</code> entries</li>
            <li>Click <strong>Run Scraper Now</strong> to trigger a manual run and see if it logs anything</li>
            <li>Verify <code>SUPABASE_SERVICE_KEY</code> in Render env vars is valid (current key returns 401)</li>
          </ul>
        </div>
      )}
    </div>
  )
}
