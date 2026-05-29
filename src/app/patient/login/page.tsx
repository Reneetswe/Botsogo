'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import NavbarClient from '@/components/NavbarClient';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError('Incorrect email or password');
      return;
    }

    router.push('/patient/dashboard');
    router.refresh();
  };

  return (
    <>
      <NavbarClient />
      <div className="screen active" id="screen-login">
        <div className="auth-wrap">
          <form className="auth-card" onSubmit={submit}>
            <Link className="auth-back" href="/"><i className="ti ti-arrow-left"></i> Back to home</Link>
            <div className="auth-head"><div className="auth-logo"><img src="/Justlogo.png" alt="Botsogo" /></div><div className="auth-h">Welcome back</div><div className="auth-s">Sign in with your email and password</div></div>
            <div className="auth-err" id="login-err-pub" style={{ display: error ? 'block' : 'none' }}>{error}</div>
            <div className="field"><label>Email</label><input type="email" id="login-email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="field"><label>Password</label><input type="password" id="login-pw" placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            <div style={{ textAlign: 'center', marginTop: '.875rem', fontSize: 11, color: 'var(--muted)' }}>Demo — <strong>you@gmail.com</strong> / <strong>ABcd123@@@</strong></div>
            <div className="divider">or</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>Don&apos;t have an account? <Link style={{ color: 'var(--teal)', fontWeight: 500, cursor: 'pointer' }} href="/patient/register">Register here</Link></div>
          </form>
        </div>
      </div>
    </>
  );
}