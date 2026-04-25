/**
 * LiveTicker.jsx — Real-time scrolling ticker
 * Uses pure CSS animation (zero JS re-renders while scrolling)
 * Pauses on hover, updates on new data.
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveUpdates, subscribeLiveUpdates, getTypeLabel } from '../services/liveUpdateService'

const ICONS = { job: '🧾', exam: '🎓', deadline: '⏰', news: '📰' }
const getIcon = (type) => ICONS[type] || '📢'

const LiveTicker = ({ speed = 50, showLabel = true }) => {
  const [updates, setUpdates]   = useState([])
  const [isPaused, setIsPaused] = useState(false)
  const unsubRef = useRef(null)

  // ── Initial data fetch + 60s polling ─────────────────────────
  const { data: initial = [] } = useQuery({
    queryKey: ['live_updates'],
    queryFn: fetchLiveUpdates,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (initial.length > 0) setUpdates(initial)
  }, [initial])

  // ── Real-time subscription (Supabase realtime) ───────────────
  useEffect(() => {
    unsubRef.current = subscribeLiveUpdates(() => {
      fetchLiveUpdates()
        .then(setUpdates)
        .catch(() => {}) // silent — will retry on next poll
    })
    return () => unsubRef.current?.()
  }, [])

  // If nothing to show and label is hidden, render nothing
  if (!showLabel && updates.length === 0) return null

  // Duration: pixels ÷ speed(px/s) = seconds
  // We duplicate the list so it can loop seamlessly
  const content = updates.length > 0 ? [...updates, ...updates] : []
  const hasUpdates = updates.length > 0

  // ~20px per item average; we want full content width to scroll past
  const durationSec = hasUpdates
    ? Math.max(15, (updates.length * 200) / speed)
    : 20

  const isUrgent = updates[0]?.priority === 'urgent'
  const bgColor  = isUrgent ? '#dc2626' : 'var(--bg-surface, #0f172a)'
  const txtColor = '#fff'

  return (
    <>
      {/* ── Keyframe definition (once, no re-renders) ─────────── */}
      <style>{`
        @keyframes nv-ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .nv-ticker-track {
          display: flex;
          align-items: center;
          gap: 2rem;
          white-space: nowrap;
          will-change: transform;
        }
        .nv-ticker-track.running {
          animation: nv-ticker-scroll ${durationSec}s linear infinite;
        }
        .nv-ticker-track.paused {
          animation-play-state: paused;
        }
        .nv-ticker-item:hover { opacity: 0.8; }
      `}</style>

      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          width:        '100%',
          overflow:     'hidden',
          background:   bgColor,
          borderBottom: '2px solid rgba(0,0,0,0.1)',
          display:      'flex',
          alignItems:   'center',
          position:     'relative',
          minHeight:    '2.25rem',
        }}
      >
        {/* LIVE label */}
        {showLabel && (
          <div style={{
            padding:     '0.5rem 0.9rem',
            fontWeight:  800,
            fontSize:    '0.75rem',
            color:       txtColor,
            flexShrink:  0,
            display:     'flex',
            alignItems:  'center',
            gap:         '0.4rem',
            borderRight: '1px solid rgba(255,255,255,0.15)',
            letterSpacing: '0.06em',
          }}>
            <span style={{ animation: 'pulse 2s infinite' }}>
              {isUrgent ? '🔴' : '🟢'}
            </span>
            LIVE
          </div>
        )}

        {/* Scrolling content */}
        {!hasUpdates ? (
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
            No live updates at the moment
          </div>
        ) : (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div
              className={`nv-ticker-track ${isPaused ? 'paused' : 'running'}`}
            >
              {content.map((update, idx) => (
                <div
                  key={`${update.id}-${idx}`}
                  className="nv-ticker-item"
                  onClick={() => update.link && window.open(update.link, '_blank')}
                  style={{
                    flexShrink: 0,
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '0.4rem',
                    color:      update.priority === 'urgent' ? '#fca5a5' : txtColor,
                    cursor:     update.link ? 'pointer' : 'default',
                    fontSize:   '0.82rem',
                    fontWeight: 500,
                    padding:    '0 0.5rem',
                    transition: 'opacity 0.2s',
                  }}
                  title={`${getTypeLabel(update.type)}: ${update.title}${update.link ? ' (click to view)' : ''}`}
                >
                  <span style={{ fontSize: '0.9rem' }}>{getIcon(update.type)}</span>
                  <span>{update.title}</span>
                  <span style={{ opacity: 0.4, marginLeft: '0.5rem' }}>•</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paused indicator */}
        {hasUpdates && isPaused && (
          <div style={{
            position:        'absolute',
            right:           '0.75rem',
            background:      'rgba(0,0,0,0.7)',
            color:           '#fff',
            padding:         '0.2rem 0.6rem',
            borderRadius:    4,
            fontSize:        '0.7rem',
            fontWeight:      600,
            pointerEvents:   'none',
          }}>
            ⏸ Paused
          </div>
        )}
      </div>
    </>
  )
}

export default LiveTicker
