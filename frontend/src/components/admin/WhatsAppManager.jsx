import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../services/supabase'

// ── API helpers ──────────────────────────────────────────────────────────────

async function waFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token   = session?.access_token
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')
  const url     = apiBase.endsWith('/api') ? `${apiBase}/admin/whatsapp${path}` : `${apiBase}/api/admin/whatsapp${path}`

  const res  = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATE_META = {
  connected:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: '🟢', label: 'Connected'   },
  connecting:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🟡', label: 'Connecting…' },
  disconnected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '🔴', label: 'Disconnected' },
  needs_reauth: { color: '#a855f7', bg: 'rgba(168,85,247,0.12)', icon: '🟣', label: 'Needs Re-scan'},
  disabled:     { color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: '⏸️', label: 'Disabled in Config' },
}
const defaultMeta = { color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: '⚪', label: 'Unknown' }

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtReason(r) {
  if (!r) return '—'
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const EVENT_BADGES = {
  connected:        { color: '#22c55e', label: '✅ Connected'      },
  disconnected:     { color: '#ef4444', label: '⚠️ Disconnected'   },
  logged_out:       { color: '#a855f7', label: '🚪 Logged Out'     },
  qr_generated:     { color: '#f59e0b', label: '📱 QR Generated'   },
  reconnect_attempt:{ color: '#64748b', label: '🔄 Reconnect Att.' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhatsAppManager() {
  const [status,  setStatus]  = useState(null)
  const [qr,      setQr]      = useState(null)
  const [logs,    setLogs]    = useState([])
  const [logMeta, setLogMeta] = useState({ page: 1, total: 0, pages: 1 })
  const [logPage, setLogPage] = useState(1)
  const logPageRef = useRef(1)  // ref copy so interval callbacks always see current page

  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingLogs,   setLoadingLogs]   = useState(true)
  const [loggingOut,    setLoggingOut]    = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [error,         setError]         = useState(null)
  const [logError,      setLogError]      = useState(null)

  const pollingRef = useRef(null)
  const logPollRef = useRef(null)

  // ── Fetch status + QR ──────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, qRes] = await Promise.all([
        waFetch('/status'),
        waFetch('/qr'),
      ])
      setStatus(sRes.data || null)
      setQr(qRes.qr || null)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  // Always resolves loadingLogs — success renders data/empty-state,
  // error renders a retry-able error message. No infinite spinner.
  const fetchLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true)
    setLogError(null)
    try {
      const res = await waFetch(`/logs?page=${page}&limit=15`)
      setLogs(res.data || [])
      setLogMeta(res.meta || { page: 1, total: 0, pages: 1 })
    } catch (err) {
      console.error('[WhatsAppManager] logs error:', err.message)
      // Critical fix: always clear loading state and expose the error
      setLogs([])
      setLogError(err.message)
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  // ── Polling setup ──────────────────────────────────────────────────────────
  // Status/QR poll: every 4 s — independent of logPage changes
  useEffect(() => {
    fetchStatus()
    pollingRef.current = setInterval(fetchStatus, 4000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchStatus])

  // Logs: load on mount, refresh every 30 s using the ref so we always
  // refresh the current page without restarting the interval on page change
  useEffect(() => {
    fetchLogs(1)
    logPollRef.current = setInterval(() => fetchLogs(logPageRef.current), 30000)
    return () => {
      if (logPollRef.current) clearInterval(logPollRef.current)
    }
  }, [fetchLogs])

  // Keep ref in sync whenever logPage state changes
  useEffect(() => {
    logPageRef.current = logPage
  }, [logPage])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setConfirmLogout(false)
    setLoggingOut(true)
    try {
      await waFetch('/logout', { method: 'POST' })
      await fetchStatus()
      await fetchLogs(1)
      setLogPage(1)
      logPageRef.current = 1
    } catch (err) {
      setError(`Logout failed: ${err.message}`)
    } finally {
      setLoggingOut(false)
    }
  }

  // ── Pagination helper ──────────────────────────────────────────────────────
  const goToPage = (page) => {
    setLogPage(page)
    logPageRef.current = page
    fetchLogs(page)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const stateKey  = (status && !status.enabled) ? 'disabled' : (status?.state || 'disconnected')
  const meta      = STATE_META[stateKey] || defaultMeta
  const connected = stateKey === 'connected'

  // Show QR panel when: we have a QR, or when we're in any non-connected,
  // non-disabled state (disconnected/needs_reauth/connecting) — so the
  // "Waiting for QR…" spinner appears immediately after a phone-side logout
  // before Baileys has had time to generate the first QR event.
  const showQRPanel = !connected && stateKey !== 'disabled' && (
    qr || stateKey === 'needs_reauth' || stateKey === 'connecting' || stateKey === 'disconnected'
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ── */}
      <div className="admin-header">
        <div className="admin-title" style={{ color: 'var(--text-primary)' }}>📱 WhatsApp Bot</div>
        <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
          Connection management &amp; event log
        </div>
      </div>

      {/* ── Error banner (API / auth errors) ── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 12, padding: '.75rem 1rem',
          color: '#ef4444', fontSize: '.85rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <span>❌ {error}</span>
          <button
            onClick={() => { setError(null); fetchStatus() }}
            style={{
              padding: '.3rem .65rem', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)',
              background: 'transparent', color: '#ef4444', cursor: 'pointer',
              fontSize: '.78rem', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >↻ Retry</button>
        </div>
      )}

      {/* ── Status card ── */}
      <div className="admin-stat-card" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Status pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '.5rem',
              background: meta.bg, border: `1px solid ${meta.color}40`,
              borderRadius: 999, padding: '.35rem .9rem',
              fontSize: '.85rem', fontWeight: 700, color: meta.color,
            }}>
              <span style={{
                width: 9, height: 9, borderRadius: '50%', background: meta.color,
                animation: connected ? 'wa-pulse 2s ease-in-out infinite' : 'none',
                flexShrink: 0,
              }} />
              {meta.label}
            </div>

            {status?.phoneNumber && (
              <span style={{ fontSize: '.82rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {status.phoneNumber}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            {connected && (
              <button
                onClick={() => setConfirmLogout(true)}
                disabled={loggingOut}
                style={{
                  padding: '.45rem .95rem', borderRadius: 10, border: '1px solid rgba(239,68,68,.4)',
                  background: 'rgba(239,68,68,.1)', color: '#ef4444',
                  fontSize: '.8rem', fontWeight: 700, cursor: loggingOut ? 'not-allowed' : 'pointer',
                  opacity: loggingOut ? 0.6 : 1, transition: 'all .2s',
                }}
              >
                {loggingOut ? '…' : '🚪 Log Out Bot'}
              </button>
            )}
            <button
              onClick={() => { fetchStatus(); fetchLogs(logPageRef.current) }}
              style={{
                padding: '.45rem .95rem', borderRadius: 10,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Detail rows */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '.65rem', marginTop: '1rem',
        }}>
          {[
            { label: 'Last Connected',    val: fmtTime(status?.lastConnectedAt)   },
            { label: 'Last Disconnected', val: fmtTime(status?.lastDisconnectedAt) },
            { label: 'Disconnect Reason', val: fmtReason(status?.disconnectReason) },
            { label: 'Queue Length',      val: status?.queueLength ?? '—'          },
            { label: 'Reconnects',        val: status?.reconnectAttempts ?? '0'    },
            { label: 'Group Configured',  val: status?.groupConfigured   ? '✅ Yes' : '❌ No' },
            { label: 'Channel Configured',val: status?.channelConfigured ? '✅ Yes' : '❌ No' },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
              <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {label}
              </span>
              <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── QR Code panel ── */}
      {showQRPanel && (
        <div className="admin-stat-card" style={{
          background: 'var(--bg-card)', borderColor: '#f59e0b40',
          border: '1px solid #f59e0b40',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '.75rem', fontSize: '.95rem' }}>
            📱 Scan QR Code to Connect
          </div>
          <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Open <strong>WhatsApp</strong> on your phone → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → scan the code below.
            The dashboard will automatically update once connected.
          </p>

          {qr ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                background: '#fff', borderRadius: 16, padding: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,.15)', display: 'inline-block',
              }}>
                <img
                  src={qr}
                  alt="WhatsApp QR Code"
                  style={{ width: 240, height: 240, display: 'block', borderRadius: 8 }}
                />
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '.75rem', padding: '2rem',
              color: 'var(--text-muted)', fontSize: '.85rem',
            }}>
              <div style={{
                width: 36, height: 36,
                border: '3px solid rgba(245,158,11,.2)',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'nv-spin 0.7s linear infinite',
              }} />
              <style>{`@keyframes nv-spin { to { transform: rotate(360deg); } }`}</style>
              Generating QR code — please wait a few seconds…
            </div>
          )}

          <div style={{
            marginTop: '1rem', padding: '.65rem .9rem',
            background: 'rgba(245,158,11,.07)', borderRadius: 10,
            fontSize: '.78rem', color: '#f59e0b', lineHeight: 1.5,
          }}>
            ⚠️ <strong>QR codes expire in ~20 seconds.</strong> The code auto-refreshes every 4s — if it expires, a new one will appear automatically.
          </div>
        </div>
      )}

      {/* ── Event Log table ── */}
      <div className="admin-stat-card" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            📋 Event Log
            {logMeta.total > 0 && (
              <span style={{ marginLeft: '.5rem', fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                ({logMeta.total} events)
              </span>
            )}
          </div>
          <button
            onClick={() => fetchLogs(logPageRef.current)}
            disabled={loadingLogs}
            style={{
              fontSize: '.75rem', padding: '.3rem .6rem', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', cursor: loadingLogs ? 'not-allowed' : 'pointer',
              opacity: loadingLogs ? 0.6 : 1,
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Loading state — only shown on first load, not on refresh */}
        {loadingLogs && logs.length === 0 && !logError ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.75rem', padding: '2rem', color: 'var(--text-muted)', fontSize: '.85rem' }}>
            <div style={{
              width: 20, height: 20,
              border: '2px solid rgba(100,116,139,.3)',
              borderTopColor: 'var(--text-muted)',
              borderRadius: '50%',
              animation: 'nv-spin 0.7s linear infinite',
              flexShrink: 0,
            }} />
            Loading event log…
          </div>

        ) : logError ? (
          /* Error state — always escapable, never an infinite spinner */
          <div style={{
            textAlign: 'center', padding: '2rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.75rem',
          }}>
            <div style={{ fontSize: '1.5rem' }}>⚠️</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
              Failed to load event log: <span style={{ color: '#ef4444' }}>{logError}</span>
            </div>
            <button
              onClick={() => fetchLogs(logPageRef.current)}
              style={{
                padding: '.4rem .9rem', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '.82rem', fontWeight: 600,
              }}
            >↻ Try Again</button>
          </div>

        ) : logs.length === 0 ? (
          /* Genuinely empty — not a spinner */
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '.85rem', lineHeight: 1.6 }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>📭</div>
            No events logged yet.<br />
            Events appear here when the bot connects, disconnects, generates a QR, or is manually logged out.
          </div>

        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', minWidth: 440 }}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Reason</th>
                  <th>Phone</th>
                  <th>Triggered By</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const badge = EVENT_BADGES[log.event_type] || { color: '#64748b', label: log.event_type }
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className="badge" style={{
                          background: badge.color + '1a',
                          color: badge.color, border: `1px solid ${badge.color}40`,
                          whiteSpace: 'nowrap', fontWeight: 700, fontSize: '.75rem',
                          padding: '.25rem .55rem', borderRadius: 999,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>
                        {fmtReason(log.reason)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                        {log.phone_number || '—'}
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                        {log.triggered_by === 'system' ? '🤖 system' : `👤 ${log.triggered_by}`}
                      </td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtTime(log.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {logMeta.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              disabled={logPage <= 1}
              onClick={() => goToPage(logPage - 1)}
              style={{
                padding: '.35rem .75rem', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: logPage <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: logPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '.82rem', fontWeight: 600,
              }}
            >← Prev</button>
            <span style={{ padding: '.35rem .6rem', fontSize: '.82rem', color: 'var(--text-muted)', lineHeight: '1.5rem' }}>
              Page {logPage} / {logMeta.pages}
            </span>
            <button
              disabled={logPage >= logMeta.pages}
              onClick={() => goToPage(logPage + 1)}
              style={{
                padding: '.35rem .75rem', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: logPage >= logMeta.pages ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: logPage >= logMeta.pages ? 'not-allowed' : 'pointer', fontSize: '.82rem', fontWeight: 600,
              }}
            >Next →</button>
          </div>
        )}
      </div>

      {/* ── Confirm Logout Modal ── */}
      {confirmLogout && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={() => setConfirmLogout(false)}>
          <div style={{
            background: 'var(--bg-surface, #1e293b)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '1.75rem', maxWidth: 380, width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '.5rem' }}>🚪</div>
            <p style={{
              color: 'var(--text-primary, #f1f5f9)', fontSize: '.95rem',
              fontWeight: 700, textAlign: 'center', marginBottom: '.5rem',
            }}>
              Log Out WhatsApp Bot?
            </p>
            <p style={{
              color: 'var(--text-muted, #94a3b8)', fontSize: '.82rem',
              textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6,
            }}>
              This will disconnect the bot from all WhatsApp groups and channels.
              You will need to scan a new QR code to reconnect. Continue?
            </p>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button
                onClick={() => setConfirmLogout(false)}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem',
                }}
              >Cancel</button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                  color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.35)',
                }}
              >Yes, Log Out</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pulse animation ── */}
      <style>{`
        @keyframes wa-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
