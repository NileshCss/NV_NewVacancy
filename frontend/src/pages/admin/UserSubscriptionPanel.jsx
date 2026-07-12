import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchStudentSubscription, fetchSubscriptionPlans,
  adminChangePlan, adminExtendSubscription, adminGrantLifetime,
  adminSetExpiry, adminResetUsage, adminIncreaseLimit,
  adminGrantSponsored, adminRevokeSponsored, adminTogglePremium,
} from '../../services/api'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (dt) => dt ? new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const StatusBadge = ({ status }) => {
  const map = {
    active: { bg: 'rgba(34,197,94,.15)', color: '#22c55e', label: '✓ Active' },
    expired: { bg: 'rgba(239,68,68,.15)', color: '#ef4444', label: '✕ Expired' },
    grace_period: { bg: 'rgba(234,179,8,.15)', color: '#eab308', label: '⚠ Grace Period' },
    cancelled: { bg: 'rgba(100,116,139,.15)', color: '#94a3b8', label: '— Cancelled' },
  }
  const s = map[status] || { bg: 'rgba(100,116,139,.15)', color: '#94a3b8', label: status || 'None' }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: 6, padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

const PlanBadge = ({ name }) => (
  <span style={{
    background: name === 'Premium' ? 'rgba(168,85,247,.15)' : name === 'Free' ? 'rgba(100,116,139,.15)' : 'rgba(59,130,246,.15)',
    color: name === 'Premium' ? '#a855f7' : name === 'Free' ? '#94a3b8' : '#60a5fa',
    border: `1px solid currentColor`,
    borderRadius: 6, padding: '2px 8px', fontSize: '11px', fontWeight: 700,
  }}>{name || 'No Plan'}</span>
)

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
  </div>
)

// ── Confirm Modal (inline) ────────────────────────────────────────────────────
const ConfirmAction = ({ msg, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  }}>
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 16, padding: '1.75rem', maxWidth: 380, width: '100%',
      boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.75rem' }}>⚠️</div>
      <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', marginBottom: '0.5rem' }}>Confirm Action</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.5 }}>{msg}</p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Confirm</button>
      </div>
    </div>
  </div>
)

// ── Action Button ─────────────────────────────────────────────────────────────
const ActionBtn = ({ icon, label, onClick, color = '#60a5fa', danger = false }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
      background: danger ? 'rgba(239,68,68,.12)' : `rgba(${color.replace('#', '').match(/.{2}/g).map(h => parseInt(h, 16)).join(',')},0.12)`,
      border: `1px solid ${danger ? 'rgba(239,68,68,.3)' : 'rgba(100,116,139,.25)'}`,
      color: danger ? '#ef4444' : color,
      fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
      whiteSpace: 'normal',
      textAlign: 'left',
    }}
  >
    {icon} {label}
  </button>
)

// ── Main Component ────────────────────────────────────────────────────────────
export default function UserSubscriptionPanel({ userId, onClose }) {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(null)   // { msg, action }
  const [activeAction, setActiveAction] = useState(null)  // which action form is open
  const [reason, setReason] = useState('')

  // action-specific inputs
  const [extendDays, setExtendDays] = useState(30)
  const [customExpiry, setCustomExpiry] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedPlanExpiry, setSelectedPlanExpiry] = useState('')
  const [limitType, setLimitType] = useState('questions')
  const [limitValue, setLimitValue] = useState('')
  const [sponsorPlanId, setSponsorPlanId] = useState('')
  const [sponsorValidityDays, setSponsorValidityDays] = useState(365)

  const qKey = ['student_sub', userId]

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: qKey,
    queryFn: () => fetchStudentSubscription(userId),
    enabled: !!userId,
    retry: 1,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qKey })
  const closeAction = () => { setActiveAction(null); setReason('') }

  const runAction = async (fn, successMsg) => {
    try {
      await fn()
      toast.success(successMsg)
      await refetch()
      invalidate()
      closeAction()
    } catch (err) {
      toast.error(err.message || 'Action failed')
    }
  }

  const withConfirm = (msg, fn) => setConfirm({ msg, action: fn })

  if (!userId) return null

  const sub = data?.subscription
  const plan = sub?.subscription_plans
  const questionUsage = data?.questionUsage || {}
  const mockUsage = data?.mockUsage || {}
  const sponsored = data?.sponsoredAccess
  const plans = data?.plans || []
  const auditHistory = data?.auditHistory || []

  const qLimit = sub?.question_limit_override ?? plan?.question_limit ?? null
  const mtLimit = sub?.mock_test_limit_override ?? plan?.mock_test_limit ?? null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    }}>
      {/* Slide-over panel */}
      <div style={{
        width: '100%', maxWidth: 560, height: '100vh',
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>🔑 Subscription Control</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>Admin override panel</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px', borderRadius: 6 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'nv-spin 0.6s linear infinite' }} />
            </div>
          )}
          {isError && (
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '1rem', color: '#ef4444', fontSize: '13px' }}>
              ❌ Failed to load subscription data: {error?.message}
            </div>
          )}

          {data && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── Current Subscription ── */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', marginBottom: '0.75rem' }}>📋 Current Subscription</div>
                {sub ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <PlanBadge name={plan?.name} />
                      <StatusBadge status={sub.status} />
                      {sponsored && <span style={{ background: 'rgba(168,85,247,.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,.3)', borderRadius: 6, padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>🎓 Sponsored</span>}
                    </div>
                    <InfoRow label="Expiry" value={sub.expires_at ? fmt(sub.expires_at) : '♾️ Lifetime'} />
                    <InfoRow label="Started" value={fmt(sub.started_at)} />
                    <InfoRow label="Questions Used" value={`${questionUsage.questions_used ?? 0} / ${qLimit ?? '∞'}`} />
                    <InfoRow label="Mock Tests Used" value={`${mockUsage.mock_tests_used ?? 0} / ${mtLimit ?? '∞'}`} />
                    {sub.question_limit_override !== null && sub.question_limit_override !== undefined && (
                      <InfoRow label="Q Limit Override" value={`${sub.question_limit_override} (custom)`} />
                    )}
                    {sub.mock_test_limit_override !== null && sub.mock_test_limit_override !== undefined && (
                      <InfoRow label="MT Limit Override" value={`${sub.mock_test_limit_override} (custom)`} />
                    )}
                  </>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '0.5rem 0' }}>
                    No active subscription — student is on free tier.
                  </div>
                )}
              </div>

              {/* ── Sponsored Access ── */}
              {sponsored && (
                <div style={{ background: 'rgba(168,85,247,.05)', border: '1px solid rgba(168,85,247,.2)', borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontWeight: 700, color: '#a855f7', fontSize: '13px', marginBottom: '0.75rem' }}>🎓 Sponsored Access</div>
                  <InfoRow label="Plan" value={sponsored.subscription_plans?.name || '—'} />
                  <InfoRow label="Reason" value={sponsored.reason || '—'} />
                  <InfoRow label="Granted By" value={sponsored.profiles?.full_name || sponsored.profiles?.email || '—'} />
                  <InfoRow label="Valid Until" value={sponsored.valid_until ? fmt(sponsored.valid_until) : 'No expiry'} />
                  <div style={{ marginTop: '0.75rem' }}>
                    <ActionBtn icon="🚫" label="Revoke Sponsored Access" danger
                      onClick={() => withConfirm('This will revoke the student\'s sponsored access immediately.', () =>
                        runAction(() => adminRevokeSponsored(sponsored.id, reason || 'Revoked by admin'), 'Sponsored access revoked')
                      )}
                    />
                  </div>
                </div>
              )}

              {/* ── Quick Actions ── */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', marginBottom: '0.75rem' }}>⚡ Quick Actions</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <ActionBtn icon="⭐" label="Activate Premium" color="#a855f7"
                    onClick={() => withConfirm('Activate Premium plan for this student?', () =>
                      runAction(() => adminTogglePremium(userId, true, 'Premium activated by admin'), 'Premium activated!')
                    )}
                  />
                  <ActionBtn icon="🔽" label="Downgrade to Free"
                    onClick={() => withConfirm('Downgrade this student to Free plan?', () =>
                      runAction(() => adminTogglePremium(userId, false, 'Downgraded to Free by admin'), 'Downgraded to Free')
                    )}
                  />
                  <ActionBtn icon="♾️" label="Grant Lifetime"
                    onClick={() => withConfirm('Set expiry to null (lifetime access)?', () =>
                      runAction(() => adminGrantLifetime(userId, reason || 'Lifetime granted by admin'), 'Lifetime access granted!')
                    )}
                  />
                  <ActionBtn icon="🔄" label="Reset Q Usage" danger
                    onClick={() => withConfirm('Reset this student\'s question usage count to 0?', () =>
                      runAction(() => adminResetUsage(userId, 'questions'), 'Question usage reset!')
                    )}
                  />
                  <ActionBtn icon="🔄" label="Reset MT Usage" danger
                    onClick={() => withConfirm('Reset this student\'s mock test usage count to 0?', () =>
                      runAction(() => adminResetUsage(userId, 'mock_tests'), 'Mock test usage reset!')
                    )}
                  />
                </div>
              </div>

              {/* ── Action Forms ── */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', marginBottom: '0.75rem' }}>🛠️ Admin Actions</div>

                {/* Action Tabs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1rem' }}>
                  {[
                    { id: 'change_plan', label: '🔄 Change Plan' },
                    { id: 'extend', label: '📅 Extend' },
                    { id: 'custom_expiry', label: '📆 Set Expiry' },
                    { id: 'limit', label: '📊 Set Limit' },
                    { id: 'sponsor', label: '🎓 Sponsor' },
                  ].map(a => (
                    <button key={a.id} onClick={() => setActiveAction(activeAction === a.id ? null : a.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: activeAction === a.id ? 'rgba(249,115,22,.15)' : 'var(--bg-surface)',
                        color: activeAction === a.id ? '#f97316' : 'var(--text-secondary)',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {a.label}
                    </button>
                  ))}
                </div>

                {/* Reason Field (shared) */}
                {activeAction && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason (logged to audit) *</label>
                    <input
                      type="text" value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Campus Ambassador, Support request..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* Change Plan Form */}
                {activeAction === 'change_plan' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px' }}>
                      <option value="">— Select Plan —</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} (Q:{p.question_limit ?? '∞'} | MT:{p.mock_test_limit ?? '∞'})</option>)}
                    </select>
                    <input type="date" value={selectedPlanExpiry} onChange={e => setSelectedPlanExpiry(e.target.value)}
                      placeholder="Expiry date (optional)"
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                    <button
                      disabled={!selectedPlanId || !reason.trim()}
                      onClick={() => withConfirm(`Change plan to "${plans.find(p => p.id === selectedPlanId)?.name}"? This will expire their current subscription.`,
                        () => runAction(() => adminChangePlan(userId, selectedPlanId, selectedPlanExpiry || null, reason), 'Plan changed!'))}
                      style={{ padding: '8px', borderRadius: 8, border: 'none', background: !selectedPlanId || !reason.trim() ? 'rgba(100,116,139,.2)' : '#f97316', color: '#fff', cursor: !selectedPlanId || !reason.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px' }}>
                      Apply Plan Change
                    </button>
                  </div>
                )}

                {/* Extend Form */}
                {activeAction === 'extend' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Days to Add</label>
                      <input type="number" min="1" max="3650" value={extendDays} onChange={e => setExtendDays(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button onClick={() => withConfirm(`Extend subscription by ${extendDays} days?`,
                        () => runAction(() => adminExtendSubscription(userId, extendDays, reason || `Extended by ${extendDays} days`), `Extended by ${extendDays} days!`))}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
                      ➕ Extend
                    </button>
                  </div>
                )}

                {/* Custom Expiry Form */}
                {activeAction === 'custom_expiry' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>New Expiry Date</label>
                      <input type="date" value={customExpiry} onChange={e => setCustomExpiry(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button onClick={() => withConfirm(`Set expiry to ${customExpiry}?`,
                        () => runAction(() => adminSetExpiry(userId, customExpiry, reason || 'Custom expiry set'), 'Expiry updated!'))}
                      disabled={!customExpiry}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: !customExpiry ? 'rgba(100,116,139,.2)' : '#2563eb', color: '#fff', cursor: !customExpiry ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
                      📆 Set
                    </button>
                  </div>
                )}

                {/* Limit Override Form */}
                {activeAction === 'limit' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['questions', 'mock_tests'].map(t => (
                        <button key={t} onClick={() => setLimitType(t)}
                          style={{ flex: 1, padding: '6px', borderRadius: 8, border: `1px solid ${limitType === t ? '#f97316' : 'var(--border)'}`, background: limitType === t ? 'rgba(249,115,22,.15)' : 'transparent', color: limitType === t ? '#f97316' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          {t === 'questions' ? '❓ Questions' : '📋 Mock Tests'}
                        </button>
                      ))}
                    </div>
                    <input type="number" min="0" value={limitValue} onChange={e => setLimitValue(e.target.value)}
                      placeholder="New limit (leave blank for unlimited)"
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                    <button onClick={() => withConfirm(`Set ${limitType} limit to ${limitValue || 'unlimited'} for this student?`,
                        () => runAction(() => adminIncreaseLimit(userId, limitType, limitValue === '' ? null : parseInt(limitValue), reason || 'Limit override by admin'), 'Limit updated!'))}
                      style={{ padding: '8px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                      📊 Apply Limit Override
                    </button>
                  </div>
                )}

                {/* Sponsor Form */}
                {activeAction === 'sponsor' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select value={sponsorPlanId} onChange={e => setSponsorPlanId(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px' }}>
                      <option value="">— Select Sponsored Plan —</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" min="1" value={sponsorValidityDays} onChange={e => setSponsorValidityDays(e.target.value)}
                        placeholder="Validity (days)"
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>days</span>
                    </div>
                    <button onClick={() => runAction(
                        () => adminGrantSponsored(userId, sponsorPlanId, reason || 'Sponsored access', sponsorValidityDays),
                        'Sponsored access granted!'
                      )}
                      disabled={!sponsorPlanId || !reason.trim()}
                      style={{ padding: '8px', borderRadius: 8, border: 'none', background: !sponsorPlanId || !reason.trim() ? 'rgba(100,116,139,.2)' : '#9333ea', color: '#fff', cursor: !sponsorPlanId || !reason.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px' }}>
                      🎓 Grant Sponsored Access
                    </button>
                  </div>
                )}
              </div>

              {/* ── Audit History ── */}
              {auditHistory.length > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', marginBottom: '0.75rem' }}>📜 Recent Activity</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {auditHistory.map((log, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>{log.action.replace(/_/g, ' ')}</div>
                          {log.reason && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 1 }}>{log.reason}</div>}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 1 }}>by {log.profiles?.full_name || log.profiles?.email || 'Admin'}</div>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {fmtTime(log.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm overlay */}
      {confirm && (
        <ConfirmAction
          msg={confirm.msg}
          onConfirm={() => { confirm.action(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
