import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Building2, MapPin, Layers, IndianRupee, 
  Users, Clock, GraduationCap, Link as LinkIcon, 
  Calendar, AlertCircle, X, Save, RotateCcw,
  Sparkles, Globe, Tag as TagIcon, FileText
} from 'lucide-react';
import { updateJob, addJob } from '../../services/api';
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
          <option key={opt.value} value={opt.value} style={{ background: 'var(--navy-8)', color: '#fff' }}>
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

  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm({
    defaultValues: isEdit ? { ...job, tags: job?.tags || [] } : {
      title: '', organization: '', location: 'All India',
      salary_range: '', apply_url: '', job_description: '',
      category: 'govt', is_featured: false, is_active: true,
      tags: [], vacancies: 1, experience_range: '0-1'
    }
  });

  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { if (job) reset(job); }, [job, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    setSaveError('');

    // ── 10-second hard timeout so it never hangs forever ──────────
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setSaveError('Request timed out after 10 seconds. Check your internet connection or Supabase RLS policy.');
    }, 10000);

    try {
      console.log('[JobVacancyForm] Submitting:', isEdit ? 'UPDATE' : 'INSERT', data);

      if (isEdit) {
        await updateJob(job.id, data);
        toast.success('Job updated! ✨');
      } else {
        await addJob(data);
        toast.success('Job posted! 🚀');
      }

      clearTimeout(timeoutId);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[JobVacancyForm] Error:', err);
      const msg = err.message || 'Failed to save job. Please try again.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div style={{
      fixed: 'inset-0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', background: 'rgba(8,14,26,0.85)', backdropFilter: 'blur(12px)'
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: '850px', maxHeight: '92vh',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
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
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <form id="job-vacancy-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
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

            {/* Section: Basic Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={16} />
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>Basic Information</h3>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <InputField label="Salary Range" name="salary_range" icon={IndianRupee} register={register} placeholder="e.g. ₹12L - ₹18L PA" />
                <InputField label="Positions" name="vacancies" icon={Users} type="number" register={register} placeholder="1" />
                <SelectField label="Experience" name="experience_range" icon={Clock} register={register} options={[{ label: 'Fresher (0-1 yr)', value: '0-1' }, { label: 'Junior (1-3 yrs)', value: '1-3' }, { label: 'Mid (3-5 yrs)', value: '3-5' }, { label: 'Senior (5+ yrs)', value: '5+' }]} />
                <InputField label="Qualification" name="qualification" icon={GraduationCap} register={register} placeholder="e.g. B.Tech, MCA" />
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <InputField label="Apply URL" name="apply_url" icon={Globe} register={register} error={errors.apply_url} required placeholder="https://..." />
                <InputField label="Last Date" name="last_date" icon={Calendar} type="date" register={register} />
              </div>
            </div>

            {/* Section: Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginLeft: '4px' }}>Full Job Description</label>
              <textarea 
                {...register('job_description')} rows={6} 
                style={{
                  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', 
                  borderRadius: '16px', padding: '16px', color: 'var(--text-primary)', 
                  fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.6'
                }}
                placeholder="Describe role, responsibilities, eligibility..."
              />
            </div>

            {/* Section: Tags */}
            <Controller
              name="tags" control={control}
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
                <input type="checkbox" {...register('is_active')} style={{ width: '18px', height: '18px', accentColor: 'var(--green)' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Visible (Active)</span>
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={() => reset(job || {})} style={{ padding: '10px 20px', borderRadius: '12px', background: 'var(--white-8)', border: 'none', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={16} /> Reset
            </button>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: '700', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
          <button 
            form="job-vacancy-form" type="submit" disabled={loading}
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        .input-wrapper:focus-within { border-color: var(--brand) !important; box-shadow: 0 0 0 4px rgba(249,115,22,0.1); }
      `}</style>
    </div>
  );
}
