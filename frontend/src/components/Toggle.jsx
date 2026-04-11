/**
 * Modern Toggle Switch Component
 * 
 * Professional on/off switch with smooth animations and visual feedback.
 * Supports two sizes: 'sm' (small) and 'lg' (large).
 * 
 * @param {boolean} active - Whether the toggle is in active state
 * @param {function} onToggle - Callback function when toggle changes
 * @param {string} size - Size of toggle: 'sm' (default) or 'lg'
 * @param {string} label - Optional label text
 * @param {string} title - Tooltip title
 * 
 * @example
 * <Toggle 
 *   active={isActive} 
 *   onToggle={() => setIsActive(!isActive)}
 *   size="sm"
 *   label="Active"
 *   title="Toggle active status"
 * />
 */

import React from 'react'

export default function Toggle({ 
  active, 
  onToggle, 
  size = 'sm',
  label = null,
  title = null,
}) {
  const isSmall = size === 'sm'
  
  // Dimensions based on size
  const containerWidth = isSmall ? 44 : 52
  const containerHeight = isSmall ? 24 : 28
  const thumbSize = isSmall ? 20 : 24
  const thumbOffset = isSmall ? 20 : 24
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: label ? '8px' : '0' }}>
      <button
        type="button"
        onClick={onToggle}
        title={title || (active ? 'Disable' : 'Enable')}
        aria-pressed={active}
        className="toggle-switch"
        style={{
          // Container
          width: containerWidth,
          height: containerHeight,
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          position: 'relative',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          
          // Background gradient
          background: active 
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
            : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
          
          // Shadow effects
          boxShadow: active 
            ? 'inset 0 2px 4px rgba(0,0,0,0.1), 0 4px 12px rgba(34, 197, 94, 0.3)' 
            : 'inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.08)',
          
          // Smooth transitions
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Animated thumb/circle */}
        <span
          className="toggle-thumb"
          style={{
            position: 'absolute',
            width: thumbSize,
            height: thumbSize,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transform: `translateX(${active ? thumbOffset : -(thumbOffset - 2)}px)`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
            pointerEvents: 'none',
          }}
        />
        
        {/* ON/OFF labels - only on small toggle */}
        {isSmall && (
          <>
            <span
              className="toggle-label-off"
              style={{
                position: 'absolute',
                left: 4,
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '0.5px',
                color: '#666',
                opacity: active ? 0 : 0.7,
                transition: 'opacity 0.25s',
                textTransform: 'uppercase',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              OFF
            </span>
            <span
              className="toggle-label-on"
              style={{
                position: 'absolute',
                right: 4,
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '0.5px',
                color: '#fff',
                opacity: active ? 1 : 0,
                transition: 'opacity 0.25s',
                textTransform: 'uppercase',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              ON
            </span>
          </>
        )}
      </button>
      
      {/* Optional label */}
      {label && (
        <label
          onClick={onToggle}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '14px',
            color: 'var(--text-primary)',
            fontWeight: '500',
            transition: 'color 0.2s',
          }}
        >
          {label}
        </label>
      )}
    </div>
  )
}
