import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Building2, MapPin, Layers, IndianRupee, 
  Users, Clock, GraduationCap, Link as LinkIcon, 
  Calendar, AlertCircle, X, Save, RotateCcw,
  Sparkles, Globe, Tag as TagIcon, FileText
} from 'lucide-react';
import { updateJob, addJob, notifyJobOnWhatsApp, scrapeJobPreview } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * Reusable Input Component using Project CSS Variables
 */
const InputField = ({ label, name, icon: Icon, register, error, placeholder, type = "text", ...rest }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
    <label style={{ 
      fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', 
      letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '4px' 
    }}>
      {label} {rest.required && <span style={{ color: 'var(--red)' }}>*</span>}
    </label>
    <div className="input-wrapper" style={{
      position: 'relative', display: 'flex', alignItems: 'center', 
      background: 'var(--bg-input)', border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: '14px', transition: 'all 0.2s ease',
      overflow: 'hidden'
    }}>
      <div style={{ paddingLeft: '14px', color: 'var(--text-muted)', display: 'flex' }}>
        <Icon size={18} />
      </div>
      <input
        {...register(name, { required: rest.required })}
        type={type}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'transparent', border: 'none', 
          padding: '12px 14px', color: 'var(--text-primary)', 
          fontSize: '14px', outline: 'none'
        }}
        {...rest}
      />
    </div>
    <AnimatePresence>
      {error && (
        <motion.span 
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} 
          style={{ fontSize: '10px', fontWeight: '700', color: 'var(--red)', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <AlertCircle size={10} /> {error.message || 'Required'}
        </motion.span>
      )}
    </AnimatePresence>
  </div>
);

/**
 * Reusable Textarea Component
 */
const TextareaField = ({ label, name, icon: Icon, register, error, placeholder, rows = 4, ...rest }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
    <label style={{ 
      fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', 
      letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '4px' 
    }}>
      {label} {rest.required && <span style={{ color: 'var(--red)' }}>*</span>}
    </label>
    <div className="input-wrapper" style={{
      position: 'relative', display: 'flex', alignItems: 'flex-start', 
      background: 'var(--bg-input)', border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: '14px', transition: 'all 0.2s ease',
      overflow: 'hidden', padding: '12px 14px'
    }}>
      <div style={{ color: 'var(--text-muted)', display: 'flex', marginTop: '2px', marginRight: '14px' }}>
        <Icon size={18} />
      </div>
      <textarea
        {...register(name, { required: rest.required })}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', background: 'transparent', border: 'none', 
          color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
          resize: 'vertical', minHeight: '80px', padding: 0
        }}
        {...rest}
      />
    </div>
    <AnimatePresence>
      {error && (
        <motion.span 
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} 
          style={{ fontSize: '10px', fontWeight: '700', color: 'var(--red)', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <AlertCircle size={10} /> {error.message || 'Required'}
        </motion.span>
      )}
    </AnimatePresence>
  </div>
);

/**
 * Reusable Select Component
 */
const SelectField = ({ label, name, icon: Icon, register, error, options, ...rest }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
    <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '4px' }}>
      {label}
    </label>
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', 
      background: 'var(--bg-input)', border: '1px solid var(--border)',
      borderRadius: '14px', transition: 'all 0.2s ease'
    }}>
      <div style={{ paddingLeft: '14px', color: 'var(--text-muted)', display: 'flex' }}>
        <Icon size={18} />
      </div>
      <select
        {...register(name)}
        style={{
          width: '100%', background: 'transparent', border: 'none', 
          padding: '12px 14px', color: 'var(--text-primary)', 
          fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none'
        }}
        {...rest}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
            {opt.label}
          </option>
        ))}
      </select>
      <div style={{ position: 'absolute', right: '14px', pointerEvents: 'none', color: 'var(--text-muted)' }}>
        <Layers size={14} />
      </div>
    </div>
  </div>
);

/**
 * Tag Input Component
 */
const TagInput = ({ label, value, onChange, placeholder, icon: Icon }) => {
  const [input, setInput] = useState('');
  const addTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = input.trim().replace(/,/g, '');
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
        setInput('');
      }
    }
  };
  const removeTag = (tagToRemove) => onChange(value.filter(t => t !== tagToRemove));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '4px' }}>
        {label}
      </label>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px 12px', minHeight: '46px',
        background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px'
      }}>
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          <Icon size={18} />
        </div>
        {value.map(tag => (
          <span key={tag} style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
            background: 'rgba(249,115,22,0.15)', color: 'var(--brand)', 
            fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.2)'
          }}>
            {tag}
            <button type="button" onClick={() => removeTag(tag)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={addTag}
          placeholder={value.length === 0 ? placeholder : ""}
          style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', minWidth: '80px' }}
        />
      </div>
    </div>
  );
};

export default function JobVacancyForm({ job, onClose, onSaved }) {
  const isEdit = Boolean(job?.id);

  const DEFAULT_VALUES = {
    title: '', organization: '', location: 'All India',
    salary_range: 'Not Disclosed', apply_url: '', description: '',
    category: 'govt', is_featured: false, visible: true,
    skill_tags: [], positions: '', qualification: '', age_limit: '', experience: '', last_date: '',
    department: '', notification_url: '',
  };

  const getInitialValues = () => {
    if (!isEdit) return DEFAULT_VALUES;
    // IMPORTANT: map DB column names → form field names here.
    // Do NOT call reset(job) directly anywhere — it bypasses this mapping.
    return {
      title:            job?.title            || '',
      organization:     job?.organization     || '',
      location:         job?.location         || 'All India',
      salary_range:     job?.salary_range     || 'Not Disclosed',
      apply_url:        job?.apply_url        || '',
      description:      job?.job_description  || job?.description || '',
      category:         job?.category         || 'govt',
      is_featured:      Boolean(job?.is_featured ?? false),
      visible:          Boolean(job?.is_active ?? job?.visible ?? true),
      skill_tags:       Array.isArray(job?.tags || job?.skill_tags) ? (job.tags || job.skill_tags) : [],
      positions:        String(job?.vacancies  || job?.positions || ''),
      qualification:    job?.qualification    || '',
      age_limit:        job?.age_limit        || '',
      experience:       job?.experience       || '',
      last_date:        job?.last_date        || '',
      department:       job?.department       || '',
      notification_url: job?.notification_url || '',
    };
  };

  const { register, handleSubmit, control, reset, setValue, formState: { errors, isDirty } } = useForm({
    defaultValues: getInitialValues()
  });

  const [loading,    setLoading]    = useState(false);
  const [saveError,  setSaveError]  = useState('');

  // ── URL Auto-Fill state ──────────────────────────────────────────────────
  const [jobUrl,     setJobUrl]     = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState(null); // { type: 'success'|'warn'|'error', text }

  // NOTE: Do NOT reset(job) here — getInitialValues() already maps DB→form fields correctly.
  // Calling reset(job) directly would bypass that mapping and break field names.

  // ── Extract job details from URL ─────────────────────────────────────────
  const extractFromUrl = async () => {
    if (!jobUrl.trim()) {
      setExtractMsg({ type: 'error', text: 'Please enter a job URL first.' });
      return;
    }
    if (!jobUrl.trim().startsWith('http')) {
      setExtractMsg({ type: 'error', text: 'URL must start with http:// or https://' });
      return;
    }

    setExtracting(true);
    setExtractMsg(null);

    try {
      const result = await scrapeJobPreview(jobUrl.trim());

      // Backend not reachable / not configured — shown when VITE_API_URL is not set in production
      if (!result) {
        setExtractMsg({ type: 'error', text: '🔌 Cannot reach the backend server. Make sure the server is running on port 5000, or set VITE_API_URL in your Vercel environment variables.' });
        return;
      }
      if (result.code === 'BACKEND_NOT_CONFIGURED') {
        setExtractMsg({ type: 'error', text: '⚙️ Backend API is not configured for production. Go to Vercel → Project Settings → Environment Variables and set VITE_API_URL to your deployed backend URL (e.g. https://your-backend.railway.app/api), then redeploy.' });
        return;
      }

      // Specific error codes from backend
      if (result.code === 'JOB_EXPIRED' || result.code === 'URL_EXPIRED' || result.status === 410) {
        setExtractMsg({ type: 'error', text: '⚠️ This job link is expired or closed. You cannot add an expired vacancy.' });
        return;
      }
      if (result.code === 'SCRAPE_BLOCKED') {
        setExtractMsg({ type: 'error', text: '🚫 This site blocks automated access. Please fill the details manually.' });
        return;
      }
      if (result.code === 'JS_RENDERED_PAGE') {
        setExtractMsg({ type: 'warn', text: '⚠️ This page requires JavaScript to load — extraction is partial. Please verify all fields.' });
        // Still try to fill what we got
      } else if (result.code === 'SCRAPE_TIMEOUT') {
        setExtractMsg({ type: 'error', text: '⏱️ The target site took too long to respond. Try again or fill manually.' });
        return;
      } else if (!result.success && !result.data) {
        setExtractMsg({ type: 'error', text: result.error || 'Failed to extract job details. Try a different URL.' });
        return;
      }

      const j = result.data;
      if (!j) {
        setExtractMsg({ type: 'error', text: 'No data returned from extraction. Try a different URL.' });
        return;
      }

      // Map AI fields → react-hook-form field names (matching addJob/updateJob payload)
      if (j.jobTitle)      setValue('title',           j.jobTitle,      { shouldDirty: true });
      if (j.company)       setValue('organization',    j.company,       { shouldDirty: true });
      if (j.location)      setValue('location',        j.location,      { shouldDirty: true });
      if (j.salary)        setValue('salary_range',    j.salary,        { shouldDirty: true });
      if (j.description)   setValue('description',     j.description,   { shouldDirty: true });
      if (j.applyLink)     setValue('apply_url',       j.applyLink,     { shouldDirty: true });
      if (j.qualification) setValue('qualification',   j.qualification, { shouldDirty: true });
      if (j.deadline)      setValue('last_date',       j.deadline,      { shouldDirty: true });
      if (j.batch)         setValue('experience',      j.batch,         { shouldDirty: true });
      if (j.vacancies)     setValue('positions',       String(j.vacancies), { shouldDirty: true });
      if (Array.isArray(j.skills) && j.skills.length > 0)
                           setValue('skill_tags',      j.skills,        { shouldDirty: true });
      // Map category: AI returns 'Government' | 'Private' etc. → DB uses 'govt' | 'private'
      if (j.category) {
        const catMap = {
          Government: 'govt', Banking: 'govt', Railway: 'govt',
          Defence: 'govt', Teaching: 'govt',
          Private: 'private', IT: 'private', Engineering: 'private',
          Healthcare: 'private', Other: 'private',
        };
        setValue('category', catMap[j.category] ?? 'private', { shouldDirty: true });
      }

      const confidence = j.confidence ?? 0;
      if (confidence === 0) {
        setExtractMsg({ type: 'warn', text: '⚠️ Could not extract details from this page (site may require login or JavaScript). Please fill the fields manually.' });
      } else if (confidence < 50) {
        setExtractMsg({ type: 'warn', text: `⚠️ Low confidence (${confidence}%). Fields auto-filled — please verify carefully.` });
      } else {
        setExtractMsg({ type: 'success', text: `✓ Details extracted (confidence: ${confidence}%). Review below and click Post Vacancy.` });
      }
    } catch (err) {
      console.error('[JobVacancyForm] extractFromUrl error:', err);
      // Distinguish between network errors and other failures
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        setExtractMsg({ type: 'error', text: '⏱️ Extraction timed out (20s). The backend may be offline or the target site is slow.' });
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('ECONNREFUSED')) {
        setExtractMsg({ type: 'error', text: '🔌 Cannot reach the backend server. Make sure the server is running on port 5000, or VITE_API_URL is set correctly.' });
      } else {
        setExtractMsg({ type: 'error', text: `Extraction failed: ${err.message}` });
      }
    } finally {
      setExtracting(false);
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setSaveError('');

    // Safety net: force-unlock the button after 35s no matter what.
    // This is a last-resort guard in case a dependency (Edge Function, Supabase)
    // returns a promise that never settles.
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setSaveError('Request timed out after 35 seconds. The job may or may not have saved — please refresh the page to check, then retry if needed.');
    }, 35000);

    try {
      console.log('[JobVacancyForm] Submitting:', isEdit ? 'UPDATE' : 'INSERT', data);

      if (isEdit) {
        const updated = await updateJob(job.id, data);
        // ── Save succeeded: close modal immediately, notify in background ──
        toast.success('Vacancy updated successfully');
        if (onSaved) onSaved();
        reset(DEFAULT_VALUES);
        setTimeout(() => onClose(), 300);

        // Fire-and-forget: WhatsApp notification must NEVER block the save path.
        // The Edge Function may be cold, slow, or undeployed — that's OK.
        if (data.visible) {
          notifyJobOnWhatsApp(updated || { id: job.id, ...data }, 'updated')
            .catch(e => toast.error(`WhatsApp notification failed (job was saved): ${e.message}`, { duration: 6000 }));
        }
      } else {
        const added = await addJob(data);
        // ── Save succeeded: close modal immediately, notify in background ──
        toast.success('Vacancy posted successfully');
        if (onSaved) onSaved();
        reset(DEFAULT_VALUES);
        setTimeout(() => onClose(), 300);

        // Fire-and-forget: WhatsApp notification must NEVER block the save path.
        if (data.visible) {
          notifyJobOnWhatsApp(added || data, 'new')
            .catch(e => toast.error(`WhatsApp notification failed (job was saved): ${e.message}`, { duration: 6000 }));
        }
      }
    } catch (err) {
      console.error('[JobVacancyForm] Error:', err);
      // If it was an AbortError from our API timeout, format it nicely
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timed out');
      const isRLS = err.message?.includes('[42501]') || err.message?.includes('row-level security') || err.message?.includes('RLS');
      const isAuth = err.message?.includes('session') || err.message?.includes('JWT') || err.message?.includes('Auth');
      let msg = '';
      
      if (isTimeout) {
        msg = 'Database connection timed out. Check your network or Supabase status and try again.';
      } else if (isRLS) {
        msg = `Permission denied (RLS): Your account role does not allow this operation. Ask your super admin to run FIX_JOBS_UPDATE_RLS_FINAL.sql in Supabase SQL Editor, then retry.\n\nFull error: ${err.message}`;
      } else if (isAuth) {
        msg = 'Your session has expired. Please refresh the page and log in again.';
      } else {
        // Surface the real error, not a generic message, so the admin can act on it.
        msg = err.message || 'Failed to save job. Open the browser console (F12) for the full error, then retry.';
      }
      
      setSaveError(msg);
      console.error('[JobVacancyForm] Full error details:', { isTimeout, isRLS, isAuth, originalError: err.message, code: err.code });
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 md:p-6"
         style={{ background: 'rgba(8,14,26,0.85)', backdropFilter: 'blur(12px)' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full flex flex-col overflow-hidden bg-[var(--bg-surface)]"
        style={{
          maxWidth: '850px', maxHeight: '92vh',
          border: '1px solid var(--border)',
          borderRadius: 'clamp(16px, 4vw, 28px)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 p-4 sm:p-5 md:px-8 md:py-6"
             style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(249,115,22,0.1)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Update Vacancy' : 'Post New Vacancy'}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                {isEdit ? `Editing Job ID: ${job?.id?.slice(0, 8)}...` : 'Create a professional job listing'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--white-8)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <form id="job-vacancy-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 md:gap-10">
            
            {/* Error Banner */}
            {saveError && (
              <div style={{ 
                padding: '14px 18px', borderRadius: '14px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: '13px', lineHeight: 1.5,
                display: 'flex', gap: '10px', alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>❌</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>Save Failed</strong>
                  {saveError}
                </div>
                <button type="button" onClick={() => setSaveError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>✕</button>
              </div>
            )}

          {/* ── URL Auto-Fill Panel ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 p-4 sm:p-5 md:p-6" style={{
              background: 'rgba(249,115,22,0.04)',
              border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: '20px',
            }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    🔗
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)' }}>Auto-Fill from URL</span>
                </div>
                <span className="ml-0 sm:ml-2 text-[11px] text-[var(--text-muted)]">Paste any job link to auto-populate all fields</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: '14px', overflow: 'hidden',
                }}>
                  <div style={{ paddingLeft: '14px', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                    <Globe size={18} />
                  </div>
                  <input
                    type="url"
                    id="jvf-url-input"
                    value={jobUrl}
                    onChange={e => { setJobUrl(e.target.value); setExtractMsg(null); }}
                    onKeyDown={e => e.key === 'Enter' && !extracting && extractFromUrl()}
                    placeholder="https://company.com/jobs/... or https://ssc.nic.in/notice..."
                    disabled={extracting}
                    className="min-h-[44px] w-full"
                    style={{
                      background: 'transparent', border: 'none',
                      padding: '12px 14px', color: 'var(--text-primary)',
                      fontSize: '13px', outline: 'none',
                    }}
                  />
                </div>
                <button
                  type="button"
                  id="jvf-extract-btn"
                  onClick={extractFromUrl}
                  disabled={extracting || !jobUrl.trim()}
                  className="min-h-[44px] justify-center"
                  style={{
                    padding: '12px 20px', borderRadius: '14px', border: 'none',
                    background: extracting || !jobUrl.trim() ? 'rgba(100,116,139,0.3)' : 'var(--brand)',
                    color: '#fff', fontWeight: '800', fontSize: '12px',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: extracting || !jobUrl.trim() ? 'not-allowed' : 'pointer',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.2s',
                  }}
                >
                  {extracting ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: '_jvf_spin .7s linear infinite', display: 'inline-block' }} />
                      Extracting…
                    </>
                  ) : (
                    <>✨ Extract Details</>
                  )}
                </button>
              </div>

              {/* Status message */}
              {extractMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px', fontSize: '12px',
                  lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '8px',
                  background: extractMsg.type === 'success'
                    ? 'rgba(34,197,94,0.08)'
                    : extractMsg.type === 'warn'
                    ? 'rgba(234,179,8,0.08)'
                    : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${
                    extractMsg.type === 'success' ? 'rgba(34,197,94,0.3)'
                    : extractMsg.type === 'warn'  ? 'rgba(234,179,8,0.3)'
                    : 'rgba(239,68,68,0.3)'
                  }`,
                  color: extractMsg.type === 'success' ? '#4ade80'
                    : extractMsg.type === 'warn' ? '#facc15'
                    : '#f87171',
                }}>
                  {extractMsg.text}
                </div>
              )}
            </div>
            {/* ── End URL Auto-Fill Panel ────────────────────────────────── */}

            {/* Section: Basic Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={16} />
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>Basic Information</h3>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '24px' }}>
                <InputField label="Job Title" name="title" icon={Briefcase} register={register} error={errors.title} required placeholder="e.g. Senior Frontend Developer" />
                <InputField label="Organization" name="organization" icon={Building2} register={register} error={errors.organization} required placeholder="e.g. Google India" />
                <InputField label="Location" name="location" icon={MapPin} register={register} error={errors.location} placeholder="All India" />
                <SelectField label="Category" name="category" icon={Layers} register={register} options={[{ label: 'Government', value: 'govt' }, { label: 'Private', value: 'private' }]} />
              </div>
            </div>

            {/* Section: Job Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>Job Details</h3>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '24px' }}>
                <InputField label="Salary Range" name="salary_range" icon={IndianRupee} register={register} placeholder="e.g. ₹12L - ₹18L PA" />
                <InputField label="Positions" name="positions" icon={Users} register={register} placeholder="e.g. 5 (number only)" type="number" />
                <InputField label="Qualification" name="qualification" icon={GraduationCap} register={register} placeholder="e.g. B.Tech, MCA" />
                <InputField label="Experience" name="experience" icon={Clock} register={register} placeholder="e.g. 2-5 years" />
                <InputField label="Age Limit" name="age_limit" icon={Users} register={register} placeholder="e.g. 18-35 years" />
              </div>
              
              <TextareaField label="Job Description" name="description" icon={FileText} register={register} placeholder="Detailed job description..." />
            </div>

            {/* Section: Application Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(249,115,22,0.1)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LinkIcon size={16} />
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>Application Info</h3>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '24px' }}>
                <InputField label="Apply URL" name="apply_url" icon={Globe} register={register} error={errors.apply_url} required placeholder="https://..." />
                <InputField label="Last Date" name="last_date" icon={Calendar} type="date" register={register} />
              </div>
            </div>

            {/* Section: Tags */}
            <Controller
              name="skill_tags" control={control}
              render={({ field }) => (
                <TagInput label="Skill Tags (Enter or Comma to add)" value={field.value} onChange={field.onChange} icon={TagIcon} placeholder="React, Node.js..." />
              )}
            />

            {/* Controls */}
            <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '20px', display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" {...register('is_featured')} style={{ width: '18px', height: '18px', accentColor: 'var(--brand)' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Mark as Featured</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" {...register('visible')} style={{ width: '18px', height: '18px', accentColor: 'var(--green)' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Visible (Active)</span>
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 sm:p-5 md:px-8 md:py-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0"
             style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex w-full sm:w-auto gap-3">
            <button type="button" onClick={() => reset(getInitialValues())} 
                    className="flex-1 sm:flex-none min-h-[44px] justify-center flex items-center gap-2"
                    style={{ padding: '10px 20px', borderRadius: '12px', background: 'var(--white-8)', border: 'none', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer' }}>
              <RotateCcw size={16} /> Reset
            </button>
            <button type="button" onClick={onClose} 
                    className="flex-1 sm:flex-none min-h-[44px] justify-center"
                    style={{ padding: '10px 20px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: '700', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
          <button 
            form="job-vacancy-form" type="submit" disabled={loading}
            className="w-full sm:w-auto min-h-[44px] justify-center"
            style={{
              padding: '12px 32px', borderRadius: '16px', 
              background: loading ? 'var(--text-muted)' : 'var(--brand)', 
              color: '#fff', fontWeight: '900', fontSize: '13px', 
              textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', 
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 8px 24px rgba(249,115,22,0.25)'
            }}
          >
            {loading ? 'Saving...' : (isEdit ? 'Update Vacancy' : 'Post Vacancy')}
            {!loading && <Save size={18} />}
          </button>
        </div>
      </motion.div>

      <style>{`
        @keyframes _jvf_spin { to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        .input-wrapper:focus-within { border-color: var(--brand) !important; box-shadow: 0 0 0 4px rgba(249,115,22,0.1); }
      `}</style>
    </div>
  );
}
