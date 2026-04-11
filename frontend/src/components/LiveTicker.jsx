/**
 * LiveTicker.jsx
 * Real-time scrolling ticker for live updates (breaking news style)
 * Features: Auto-scroll, pause on hover, real-time updates, priority styling
 * Last Updated: April 1, 2026
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveUpdates, subscribeLiveUpdates, getTypeLabel } from '../services/liveUpdateService'

const LiveTicker = ({ speed = 50, showLabel = true }) => {
  const [updates, setUpdates] = useState([])
  const [isPaused, setIsPaused] = useState(false)
  const [position, setPosition] = useState(0)
  const tickerRef = useRef(null)
  const contentRef = useRef(null)
  const unsubscribeRef = useRef(null)

  // ============================================================================
  // QUERIES
  // ============================================================================

  const { data: initialUpdates = [], isLoading } = useQuery({
    queryKey: ['live_updates'],
    queryFn: fetchLiveUpdates,
    refetchInterval: 60000 // Refresh every 60 seconds
  })

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize with fetched updates
  useEffect(() => {
    if (initialUpdates.length > 0) {
      setUpdates(initialUpdates)
    }
  }, [initialUpdates])

  // Set up real-time subscriptions
  useEffect(() => {
    unsubscribeRef.current = subscribeLiveUpdates((payload) => {
      // Re-fetch updates on any change
      fetchLiveUpdates()
        .then(setUpdates)
        .catch((err) => console.error('Error refetching updates:', err))
    })

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  // Animation loop
  useEffect(() => {
    if (!contentRef.current || updates.length === 0 || isPaused || isLoading) {
      return
    }

    const interval = setInterval(() => {
      setPosition((prev) => {
        const maxScroll = contentRef.current?.scrollWidth || 0
        const newPos = prev - speed / 60 // Divide by 60 for smooth animation at 60fps
        return newPos <= -maxScroll ? 0 : newPos
      })
    }, 1000 / 60) // 60fps

    return () => clearInterval(interval)
  }, [speed, isPaused, updates.length, isLoading])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleUpdateClick = (link) => {
    if (link) {
      window.open(link, '_blank')
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  const getTypeIcon = (type) => {
    const icons = {
      job: '🧾',
      exam: '🎓',
      deadline: '⏰',
      news: '📰'
    }
    return icons[type] || '📢'
  }

  const getUrgentStyles = (priority) => {
    if (priority === 'urgent') {
      return {
        backgroundColor: '#dc2626',
        color: '#fff'
      }
    }
    return {
      backgroundColor: '#0f172a',
      color: '#fff'
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!showLabel && updates.length === 0) {
    return null
  }

  return (
    <div
      ref={tickerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        width: '100%',
        overflow: 'hidden',
        backgroundColor: isLoading ? '#f3f4f6' : getUrgentStyles(updates[0]?.priority).backgroundColor,
        borderBottom: '2px solid rgba(0,0,0,0.1)',
        position: 'relative',
        cursor: 'pointer'
      }}
    >
      {/* Label Section */}
      {showLabel && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: getUrgentStyles(updates[0]?.priority).backgroundColor,
            color: getUrgentStyles(updates[0]?.priority).color,
            fontWeight: '700',
            fontSize: '0.9rem',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '1.2rem', animation: 'pulse 2s infinite' }}>
            {updates[0]?.priority === 'urgent' ? '🔴' : '🟢'}
          </span>
          <span>LIVE</span>
        </div>
      )}

      {/* Scrolling Content */}
      {isLoading ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            color: '#6b7280'
          }}
        >
          Loading updates...
        </div>
      ) : updates.length === 0 ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            color: '#6b7280'
          }}
        >
          No live updates at the moment
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            padding: '0.75rem 1rem',
            minHeight: '2.5rem'
          }}
        >
          <div
            ref={contentRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              whiteSpace: 'nowrap',
              transform: `translateX(${position}px)`,
              transition: isPaused ? 'none' : 'transform 0.05s linear'
            }}
          >
            {/* Render updates multiple times for infinite scroll effect */}
            {[...updates, ...updates].map((update, idx) => (
              <div
                key={`${update.id}-${idx}`}
                onClick={() => handleUpdateClick(update.link)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: getUrgentStyles(update.priority).backgroundColor,
                  color: getUrgentStyles(update.priority).color,
                  borderRadius: '0.25rem',
                  cursor: update.link ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  if (update.link) {
                    e.target.style.opacity = '0.8'
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1'
                }}
                title={`${getTypeLabel(update.type)}: ${update.title}${update.link ? ' (Click to view)' : ''}`}
              >
                {/* Icon */}
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                  {getTypeIcon(update.type)}
                </span>

                {/* Update Text */}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {update.title}
                </span>

                {/* Separator */}
                <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>•</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pause Hint */}
      {updates.length > 0 && isPaused && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            pointerEvents: 'none'
          }}
        >
          ⏸ Paused
        </div>
      )}

      {/* Pulse Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

export default LiveTicker
