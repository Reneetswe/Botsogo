'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember } from '@/types';

export default function StaffLoginPage() {
  const router = useRouter();
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('staff')
      .select('*')
      .eq('staff_code', staffId)
      .eq('pin_hash', pin)
      .single();

    if (queryError || !data) {
      setError('Incorrect Staff ID or PIN. Please try again.');
      return;
    }

    const staff = data as StaffMember;
    document.cookie = `botsogo_staff=${staff.id}; path=/; max-age=86400; SameSite=Lax`;
    router.push('/staff/dashboard');
  };

  return (
    <div className="screen active" id="screen-staff-login">
      <div className="staff-login-wrap">
        <form className="slc" onSubmit={submit}>
          <div className="sl-top"><div className="auth-logo"><img src="/Justlogo.png" alt="Botsogo" /></div><div className="sl-badge"><i className="ti ti-lock" style={{ fontSize: 10 }}></i>&nbsp;Staff access only</div><div className="sl-h">Botsogo Staff Portal</div><div className="sl-s">Gaborone West Clinic — sign in with your staff credentials</div></div>
          <div className="auth-err" id="sl-err" style={{ display: error ? 'block' : 'none' }}>{error}</div>
          <div className="field"><label>Staff ID</label><input type="text" id="sl-id" placeholder="e.g. CLQ-0042" value={staffId} onChange={(event) => setStaffId(event.target.value)} /></div>
          <div className="field"><label>PIN</label><input type="password" id="sl-pin" placeholder="4-digit PIN" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value)} /></div>
          <button className="auth-btn" type="submit"><i className="ti ti-login" style={{ marginRight: 6 }}></i>Sign in</button>
          <div style={{ textAlign: 'center', marginTop: '.875rem', fontSize: 11, color: 'var(--muted)' }}>Demo — <strong>CLQ-0042</strong> / <strong>1234</strong> &nbsp;(Nurse)&nbsp; · &nbsp;<strong>CLQ-0010</strong> / <strong>5678</strong> &nbsp;(Doctor)</div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}><Link className="sl-back" href="/"><i className="ti ti-arrow-left" style={{ fontSize: 12 }}></i>Back to public site</Link></div>
        </form>
      </div>
    </div>
  );
}
