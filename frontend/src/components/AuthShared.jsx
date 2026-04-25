// ─────────────────────────────────────────────────────────────────────────────
// AuthShared.jsx — reusable pieces shared by LoginPage & SignupPage
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'

// Shared email validation regex
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Supabase not-configured warning banner ────────────────────────────────────
export function AuthBanner() {
  return (
    <div
      style={{
        background:    '#7c2d12',
        color:         '#fed7aa',
        borderRadius:  10,
        padding:       '.75rem 1rem',
        marginBottom:  '1rem',
        fontSize:      '.82rem',
        border:        '1px solid #ea580c',
        lineHeight:    1.5,
      }}
    >
      ⚠️ <strong>Supabase not configured.</strong>
      <br />
      Create <code>frontend/.env</code> with your Supabase URL and anon key.
    </div>
  )
}

// ── Google OAuth button ───────────────────────────────────────────────────────
export function GoogleButton({ onClick, disabled }) {
  return (
    <button
      className="google-btn"
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {disabled ? 'Please wait...' : 'Continue with Google'}
    </button>
  )
}

// ── Email / password form field with inline error ─────────────────────────────
export function FormInput({ label, error, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {error && (
        <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── Submit button with built-in spinner state ─────────────────────────────────
export function SpinnerBtn({ loading, loadingText, children, ...rest }) {
  return (
    <button className="form-submit" type="submit" disabled={loading} {...rest}>
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
          <span
            style={{
              width:           16,
              height:          16,
              border:          '2px solid rgba(255,255,255,.4)',
              borderTopColor:  '#fff',
              borderRadius:    '50%',
              animation:       'spin .7s linear infinite',
              display:         'inline-block',
            }}
          />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

// ── Or-divider ────────────────────────────────────────────────────────────────
export function AuthDivider() {
  return (
    <div className="divider">
      <div className="divider-line" />
      <span className="divider-text">or with email</span>
      <div className="divider-line" />
    </div>
  )
}
