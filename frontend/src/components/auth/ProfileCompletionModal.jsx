import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../services/supabase';

export default function ProfileCompletionModal() {
  const { user, profile, showProfileCompletion, isEditingProfile, markProfileComplete, setIsEditingProfile } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1);

  // Sync formData when profile changes (e.g. opened for editing)
  useEffect(() => {
    if (isEditingProfile && profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        location: profile.location || '',
        newPassword: '',
        confirmPassword: '',
      });
      setStep(1);
      setErrors({});
    }
  }, [isEditingProfile, profile]);

  if (!showProfileCompletion && !isEditingProfile) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateStep1 = () => {
    const errs = {};
    if (!formData.full_name.trim()) errs.full_name = 'Name is required';
    if (formData.full_name.trim().length < 2) errs.full_name = 'Enter your full name';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (formData.newPassword) {
      if (formData.newPassword.length < 8)
        errs.newPassword = 'Password must be at least 8 characters';
      if (formData.newPassword !== formData.confirmPassword)
        errs.confirmPassword = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const withTimeout = (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
    ]);
  };

  const handleSaveProfile = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    setErrors({});

    try {
      const updates = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
      };

      // Wrap in a timeout so it never gets stuck forever
      const result = await withTimeout(markProfileComplete(updates), 15000);
      
      if (!result.success) {
        setErrors({ submit: result.error || 'Failed to save profile' });
        toast(result.error || 'Failed to save profile', 'error');
        setLoading(false);
        return;
      }

      if (formData.newPassword && formData.newPassword === formData.confirmPassword) {
        try {
          const { error } = await withTimeout(supabase.auth.updateUser({ password: formData.newPassword }), 10000);
          if (error) {
            console.error('[ProfileCompletion] Password update error:', error.message);
            toast(error.message, 'error');
          } else {
            toast('Profile and password updated successfully!', 'success');
          }
        } catch (err) {
          console.error('[ProfileCompletion] Password timeout/error:', err.message);
          toast('Password update failed or timed out', 'error');
        }
      } else {
        toast('Profile updated successfully!', 'success');
      }
      
      // Force close if it didn't unmount naturally
      setIsEditingProfile(false);
    } catch (err) {
      console.error('[ProfileCompletion] Unexpected error:', err);
      setErrors({ submit: err.message || 'An unexpected error occurred' });
      toast('An unexpected error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await markProfileComplete({ full_name: formData.full_name || profile?.full_name || '' });
  };

  const handleCancel = () => {
    setIsEditingProfile(false);
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  };

  const cardStyle = {
    background: '#1A1D27', border: '1px solid #2A2D3A', borderRadius: '16px',
    width: '100%', maxWidth: '440px', overflow: 'hidden',
    animation: 'profilePopIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', position: 'relative'
  };

  const inputStyle = {
    width: '100%', background: '#111318', border: '1px solid #374151', borderRadius: '8px',
    padding: '11px 14px', color: '#F9FAFB', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '6px' };

  return (
    <>
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <div style={{ height: '4px', background: 'linear-gradient(90deg,#F97316,#FB923C,#FDBA74)' }} />
          
          {isEditingProfile && (
            <button onClick={handleCancel} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: 20, cursor: 'pointer' }}>×</button>
          )}

          <div style={{ padding: '24px 24px 0' }}>
            {profile?.avatar_url && (
              <img src={profile.avatar_url} alt="profile" style={{ width: '52px', height: '52px', borderRadius: '50%', marginBottom: '14px', border: '2px solid #374151' }} />
            )}

            <h2 style={{ color: '#F9FAFB', fontSize: '20px', fontWeight: '800', marginBottom: '6px', lineHeight: '1.2' }}>
              {isEditingProfile ? 'Update your profile ✏️' : 'Complete your profile 👋'}
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              {isEditingProfile 
                ? 'Update your personal details and password below.' 
                : 'Welcome to NewVacancy! You signed in with Google. Add a few details to set up your profile.'}
            </p>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              {[1, 2].map(s => (
                <div key={s} style={{ height: '3px', flex: 1, borderRadius: '2px', background: step >= s ? '#F97316' : '#2A2D3A', transition: 'background 0.3s' }} />
              ))}
            </div>
          </div>

          <div style={{ padding: '0 24px 20px' }}>
            {step === 1 && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input name="full_name" value={formData.full_name} onChange={handleChange} placeholder="Your full name" autoFocus style={{ ...inputStyle, borderColor: errors.full_name ? '#EF4444' : '#374151' }} onFocus={e => e.target.style.borderColor = '#F97316'} onBlur={e => e.target.style.borderColor = errors.full_name ? '#EF4444' : '#374151'} />
                  {errors.full_name && <p style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px' }}>{errors.full_name}</p>}
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Phone Number <span style={{ color: '#6B7280', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" style={inputStyle} onFocus={e => e.target.style.borderColor = '#F97316'} onBlur={e => e.target.style.borderColor = '#374151'} />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Location <span style={{ color: '#6B7280', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <input name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Bangalore, Karnataka" style={inputStyle} onFocus={e => e.target.style.borderColor = '#F97316'} onBlur={e => e.target.style.borderColor = '#374151'} />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { if (validateStep1()) setStep(2); }} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Next →</button>
                  <button onClick={handleSaveProfile} disabled={loading} style={{ flex: 1, padding: '12px', background: loading ? '#374151' : 'transparent', border: '1px solid #374151', color: '#9CA3AF', borderRadius: '8px', fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Saving...' : 'Save & Skip password'}</button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ background: '#0C1F35', border: '1px solid #1E3A5F', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
                  <p style={{ color: '#93C5FD', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>💡 Set a password so you can also log in with email + password.<br /><span style={{ color: '#6B7280', fontSize: '12px' }}>You can skip this — Google login will always work.</span></p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>New Password <span style={{ color: '#6B7280', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <input name="newPassword" type="password" value={formData.newPassword} onChange={handleChange} placeholder="Minimum 8 characters" style={{ ...inputStyle, borderColor: errors.newPassword ? '#EF4444' : '#374151' }} onFocus={e => e.target.style.borderColor = '#F97316'} onBlur={e => e.target.style.borderColor = errors.newPassword ? '#EF4444' : '#374151'} />
                  {errors.newPassword && <p style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px' }}>{errors.newPassword}</p>}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Repeat your password" style={{ ...inputStyle, borderColor: errors.confirmPassword ? '#EF4444' : '#374151' }} onFocus={e => e.target.style.borderColor = '#F97316'} onBlur={e => e.target.style.borderColor = errors.confirmPassword ? '#EF4444' : '#374151'} />
                  {errors.confirmPassword && <p style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px' }}>{errors.confirmPassword}</p>}
                </div>

                {errors.submit && <div style={{ background: '#FEE2E2', borderRadius: '8px', padding: '10px', color: '#991B1B', fontSize: '13px', marginBottom: '12px' }}>⚠️ {errors.submit}</div>}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setStep(1)} style={{ padding: '12px 16px', background: 'transparent', border: '1px solid #374151', color: '#9CA3AF', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>← Back</button>
                  <button onClick={() => { if (validateStep2()) handleSaveProfile(); }} disabled={loading} style={{ flex: 1, padding: '12px', background: loading ? '#374151' : 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Saving...' : '✓ Complete Profile'}</button>
                </div>

                {!isEditingProfile && (
                  <button onClick={handleSkip} style={{ width: '100%', marginTop: '10px', padding: '8px', background: 'none', border: 'none', color: '#6B7280', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Skip for now — I'll complete this later</button>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      <style>{`
        @keyframes profilePopIn {
          from { opacity:0; transform:scale(0.93) translateY(12px) }
          to   { opacity:1; transform:scale(1) translateY(0) }
        }
      `}</style>
    </>
  );
}
