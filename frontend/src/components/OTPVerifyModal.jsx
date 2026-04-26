import { useState, useRef, useEffect } from 'react'
import { supabase } from '../services/supabase'

export default function OTPVerifyModal({
  email,
  onSuccess,
  onClose,
  type = 'signup'
}) {
  const [otp, setOtp]           = useState(['', '', '', '', '', '', '', ''])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const [canResend, setCanResend]     = useState(false)
  const inputRefs = useRef([])

  // ── Start resend countdown ───────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true)
      return
    }
    const timer = setTimeout(() => setResendTimer(t => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendTimer])

  // ── Auto-focus first input on mount ─────────────────
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // ── Handle individual digit input ────────────────────
  const handleChange = (index, value) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1)

    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setError('')

    // Auto-advance to next input
    if (digit && index < 7) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 8 digits entered
    if (digit && index === 7) {
      const fullOtp = [...newOtp].join('')
      if (fullOtp.length === 8) {
        setTimeout(() => handleVerify(fullOtp), 100)
      }
    }
  }

  // ── Handle backspace ─────────────────────────────────
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
      }
    }

    if (e.key === 'Enter') {
      const fullOtp = otp.join('')
      if (fullOtp.length === 8) handleVerify(fullOtp)
    }
  }

  // ── Handle paste ─────────────────────────────────────
  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 8)

    if (pasted.length > 0) {
      const newOtp = ['', '', '', '', '', '', '', '']
      pasted.split('').forEach((char, i) => {
        if (i < 8) newOtp[i] = char
      })
      setOtp(newOtp)
      setError('')

      // Focus last filled or next empty
      const nextIndex = Math.min(pasted.length, 7)
      inputRefs.current[nextIndex]?.focus()

      // Auto-submit if 8 digits pasted
      if (pasted.length === 8) {
        setTimeout(() => handleVerify(pasted), 100)
      }
    }
  }

  // ── Verify OTP ───────────────────────────────────────
  const handleVerify = async (otpString) => {
    const code = otpString || otp.join('')
    if (code.length !== 8) {
      setError('Please enter all 8 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Supabase verifyOtp type reference:
      //   'signup'       → OTP sent by signUp()            ← our case
      //   'email'        → OTP sent by signInWithOtp()     ← magic link
      //   'email_change' → OTP sent for email change
      // Using 'email' for signup OTPs causes "token expired" because
      // Supabase looks for a different token type in its DB.
      const otpType = type === 'email_change' ? 'email_change'
                    : type === 'email'        ? 'email'
                    : 'signup'   // default: signup flow

      const { data, error: verifyError } =
        await supabase.auth.verifyOtp({
          email,
          token: code,
          type: otpType,
        })

      if (verifyError) {
        throw verifyError
      }

      if (data?.session) {
        onSuccess(data.session)
      } else if (data?.user) {
        // Some Supabase configs return user but not session on verify
        onSuccess(data)
      } else {
        throw new Error('Verification failed. Please try again.')
      }

    } catch (err) {
      const msg = err.message || ''
      const lower = msg.toLowerCase()
      let errorMsg
      if (lower.includes('expired') || lower.includes('otp_expired')) {
        errorMsg = 'OTP expired. Please request a new one.'
      } else if (lower.includes('invalid') || lower.includes('otp_disabled') || lower.includes('token')) {
        errorMsg = 'Wrong OTP code. Please check and try again.'
      } else if (lower.includes('rate') || lower.includes('too many')) {
        errorMsg = 'Too many attempts. Please wait before trying again.'
      } else {
        errorMsg = msg || 'Verification failed. Try again.'
      }
      setError(errorMsg)
      // Clear OTP on error so user can re-enter
      setOtp(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    try {
      // Use the same type prop passed to the modal — don't hardcode 'signup'
      const resendType = type === 'email_change' ? 'email_change' : 'signup'
      const { error } = await supabase.auth.resend({
        type: resendType,
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error

      setCanResend(false)
      setResendTimer(60)
      setError('')
      setOtp(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()

    } catch (err) {
      const lower = err.message?.toLowerCase() || ''
      if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('over_email_send_rate_limit')) {
        setError('Too many requests. Please wait a minute before resending.')
      } else {
        setError(err.message || 'Failed to resend OTP. Try again later.')
      }
    }
  }

  return (
    // ── Overlay backdrop ──────────────────────────────
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes nv-spin { to { transform: rotate(360deg) } }
        .otp-input:focus { outline: none; }
      `}</style>

      {/* ── Modal box ────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #E2E8F0)',
        borderRadius: '24px',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.3s ease',
        position: 'relative',
      }}>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'var(--white-5, rgba(0,0,0,0.04))',
            border: '1px solid var(--border, #E2E8F0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
          }}
        >
          ✕
        </button>

        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
            border: '2px solid rgba(249,115,22,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 1rem',
          }}>
            📧
          </div>

          <h2 style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: 'var(--text-primary, #0F172A)',
            marginBottom: '0.5rem',
          }}>
            Verify Your Email
          </h2>

          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted, #94A3B8)',
            lineHeight: 1.6,
          }}>
            We sent an 8-digit code to
            <br/>
            <strong style={{
              color: 'var(--brand, #f97316)',
              fontWeight: 700,
            }}>
              {email}
            </strong>
          </p>
        </div>

        {/* OTP Input boxes */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          justifyContent: 'center',
          marginBottom: '1.25rem',
        }}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              className="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={loading}
              style={{
                width: '42px',
                height: '52px',
                textAlign: 'center',
                fontSize: '1.3rem',
                fontWeight: 800,
                fontFamily: 'Sora, monospace',
                borderRadius: '14px',
                border: `2px solid ${
                  error
                    ? '#ef4444'
                    : digit
                    ? 'var(--brand, #f97316)'
                    : 'var(--border, #E2E8F0)'
                }`,
                background: digit
                  ? 'rgba(249,115,22,0.06)'
                  : 'var(--bg-input, #F1F5F9)',
                color: 'var(--text-primary, #0F172A)',
                transition: 'all 0.15s ease',
                cursor: 'text',
                caretColor: 'var(--brand)',
              }}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px',
            padding: '0.65rem 0.9rem',
            fontSize: '0.82rem',
            color: '#ef4444',
            marginBottom: '1rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            justifyContent: 'center',
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={() => handleVerify()}
          disabled={loading || otp.join('').length !== 8}
          style={{
            width: '100%',
            padding: '0.9rem',
            background: loading || otp.join('').length !== 8
              ? 'var(--border, #E2E8F0)'
              : 'var(--brand, #f97316)',
            color: loading || otp.join('').length !== 8
              ? 'var(--text-muted)'
              : '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: 700,
            fontFamily: 'DM Sans, sans-serif',
            cursor: loading || otp.join('').length !== 8
              ? 'not-allowed'
              : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: 18,
                height: 18,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'nv-spin 0.6s linear infinite',
              }}/>
              Verifying...
            </>
          ) : (
            '✓ Verify & Continue'
          )}
        </button>

        {/* Resend section */}
        <div style={{ textAlign: 'center' }}>
          {canResend ? (
            <button
              onClick={handleResend}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand, #f97316)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                textDecoration: 'underline',
              }}
            >
              Resend OTP Code
            </button>
          ) : (
            <p style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted, #94A3B8)',
              margin: 0,
            }}>
              Resend code in{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {resendTimer}s
              </strong>
            </p>
          )}
        </div>

        {/* Help text */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted, #94A3B8)',
          marginTop: '1rem',
          lineHeight: 1.5,
        }}>
          Check spam/promotions folder if you don't see the email.
          <br/>
          Code expires in <strong>10 minutes</strong>. Enter all <strong>8 digits</strong>.
        </p>
      </div>
    </div>
  )
}
