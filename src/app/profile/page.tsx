'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { PatientProfile, Clinic } from '@/types';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [formData, setFormData] = useState({
    fname: '',
    lname: '',
    phone: '',
    preferred_clinic_id: '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        setError('Unable to load your profile. Please try again.');
        setLoading(false);
        return;
      }

      setProfile(profileData as PatientProfile);
      setFormData({
        fname: profileData.fname,
        lname: profileData.lname,
        phone: profileData.phone,
        preferred_clinic_id: profileData.preferred_clinic_id || '',
      });

      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('*')
        .order('name', { ascending: true });

      setClinics((clinicsData ?? []) as Clinic[]);
      setLoading(false);
    };

    void fetchData();
  }, [router]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        fname: formData.fname,
        lname: formData.lname,
        phone: formData.phone,
        preferred_clinic_id: formData.preferred_clinic_id || null,
      })
      .eq('id', user.id);

    if (updateError) {
      setError('Failed to update profile. Please try again.');
      return;
    }

    setSuccess('Profile updated successfully');
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });

    if (updateError) {
      setPasswordError('Failed to update password. Please try again.');
      return;
    }

    setPasswordSuccess('Password updated successfully');
    setPasswordData({ newPassword: '', confirmPassword: '' });
  };

  if (loading) {
    return (
      <div className="screen active" id="screen-profile">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="screen active" id="screen-profile">
      <div className="auth-card" style={{ maxWidth: 500, margin: '2rem auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn-ghost" type="button" onClick={() => router.push('/dashboard')} style={{ marginBottom: '1rem' }}>
            ← Back to dashboard
          </button>
          <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>My Profile</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Update your personal information and preferences</p>
        </div>

        <form onSubmit={handleProfileSubmit}>
          <div className="field">
            <label>First name</label>
            <input
              type="text"
              value={formData.fname}
              onChange={(e) => setFormData({ ...formData, fname: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Last name</label>
            <input
              type="text"
              value={formData.lname}
              onChange={(e) => setFormData({ ...formData, lname: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Phone number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Preferred clinic</label>
            <select
              value={formData.preferred_clinic_id}
              onChange={(e) => setFormData({ ...formData, preferred_clinic_id: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 14, background: 'var(--bg)', color: 'var(--navy)' }}
            >
              <option value="">No preference</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{error}</div>}
          {success && <div style={{ marginBottom: '1rem', padding: '10px 12px', background: 'var(--grn-bg)', color: 'var(--green)', borderRadius: 'var(--r)', fontSize: 13 }}>{success}</div>}
          <button className="auth-btn" type="submit">Save changes</button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginBottom: '1rem' }}>Change password</h3>
          <form onSubmit={handlePasswordSubmit}>
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
              />
            </div>
            {passwordError && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{passwordError}</div>}
            {passwordSuccess && <div style={{ marginBottom: '1rem', padding: '10px 12px', background: 'var(--grn-bg)', color: 'var(--green)', borderRadius: 'var(--r)', fontSize: 13 }}>{passwordSuccess}</div>}
            <button className="auth-btn" type="submit">Update password</button>
          </form>
        </div>
      </div>
    </div>
  );
}
