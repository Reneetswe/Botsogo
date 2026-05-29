'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import NavbarClient from '@/components/NavbarClient';
import { createClient } from '@/lib/supabase/client';
import type { Clinic } from '@/types';

interface RegisterForm {
  fname: string;
  lname: string;
  omang: string;
  countryCode: string;
  phone: string;
  preferredClinicId: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface CountryCodeOption {
  label: string;
  value: string;
  phoneLength: number;
}

const countryCodes: CountryCodeOption[] = [
  { label: 'Botswana (+267)', value: '+267', phoneLength: 8 },
  { label: 'South Africa (+27)', value: '+27', phoneLength: 9 },
  { label: 'Zimbabwe (+263)', value: '+263', phoneLength: 9 },
  { label: 'Namibia (+264)', value: '+264', phoneLength: 9 },
  { label: 'Zambia (+260)', value: '+260', phoneLength: 9 },
];

const namePattern = /^[A-Za-z' -]+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    fname: '',
    lname: '',
    omang: '',
    countryCode: '+267',
    phone: '',
    preferredClinicId: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clinicsLoading, setClinicsLoading] = useState(true);

  useEffect(() => {
    const loadClinics = async () => {
      const supabase = createClient();
      const { data, error: clinicsError } = await supabase
        .from('clinics')
        .select('id,name,location,lat,lng,created_at')
        .order('name', { ascending: true });

      if (clinicsError) {
        setError('Unable to load clinics. Please refresh and try again.');
      } else {
        setClinics(data ?? []);
      }

      setClinicsLoading(false);
    };

    void loadClinics();
  }, []);

  const update = (key: keyof RegisterForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectedCountry = countryCodes.find((country) => country.value === form.countryCode) ?? countryCodes[0];
  const fullPhoneNumber = `${form.countryCode}${form.phone}`;

  const validate = () => {
    if (!form.fname || !form.lname || !form.omang || !form.phone || !form.preferredClinicId || !form.email || !form.password || !form.confirmPassword) {
      return 'Please fill in all fields.';
    }

    if (!namePattern.test(form.fname.trim())) {
      return 'First name can only contain letters, spaces, apostrophes, or hyphens.';
    }

    if (!namePattern.test(form.lname.trim())) {
      return 'Last name can only contain letters, spaces, apostrophes, or hyphens.';
    }

    if (!/^\d+$/.test(form.omang)) {
      return 'Omang / ID number must contain numbers only.';
    }

    if (form.omang.length < 7 || form.omang.length > 12) {
      return 'Omang / ID number must be between 7 and 12 digits.';
    }

    if (!/^\d+$/.test(form.phone)) {
      return 'Mobile number must contain numbers only.';
    }

    if (form.phone.length !== selectedCountry.phoneLength) {
      return `Mobile number for ${selectedCountry.label} must be ${selectedCountry.phoneLength} digits after the country code.`;
    }

    if (!emailPattern.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }

    if (!passwordPattern.test(form.password)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
    }

    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? 'Unable to create account. Please try again.');
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: signUpData.user.id,
      fname: form.fname.trim(),
      lname: form.lname.trim(),
      omang: form.omang,
      phone: fullPhoneNumber,
      preferred_clinic_id: form.preferredClinicId,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push('/patient/dashboard');
    router.refresh();
  };

  return (
    <>
      <NavbarClient />
      <div className="screen active" id="screen-register">
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submit}>
          <Link className="auth-back" href="/">
            <i className="ti ti-arrow-left"></i> Back to home
          </Link>

          <div className="auth-head">
            <div className="auth-logo">
              <img src="/Justlogo.png" alt="Botsogo" />
            </div>
            <div className="auth-h">Create your account</div>
            <div className="auth-s">Register to join the Botsogo queue from anywhere and track your queue</div>
          </div>

          <div className="auth-err" id="reg-err" style={{ display: error ? 'block' : 'none' }}>
            {error}
          </div>

          <div className="field-row">
            <div className="field">
              <label>First name</label>
              <input
                type="text"
                id="reg-fname"
                placeholder="Kabo"
                value={form.fname}
                onChange={(event) => update('fname', event.target.value.replace(/[0-9]/g, ''))}
              />
            </div>
            <div className="field">
              <label>Last name</label>
              <input
                type="text"
                id="reg-lname"
                placeholder="Mmolawa"
                value={form.lname}
                onChange={(event) => update('lname', event.target.value.replace(/[0-9]/g, ''))}
              />
            </div>
          </div>

          <div className="field">
            <label>Omang / ID number</label>
            <input
              type="text"
              id="reg-id"
              placeholder="123456789"
              maxLength={12}
              inputMode="numeric"
              value={form.omang}
              onChange={(event) => update('omang', event.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Code</label>
              <select id="reg-phone-code" value={form.countryCode} onChange={(event) => update('countryCode', event.target.value)}>
                {countryCodes.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Mobile number</label>
              <input
                type="tel"
                id="reg-phone"
                placeholder="71 234 567"
                inputMode="numeric"
                maxLength={selectedCountry.phoneLength}
                value={form.phone}
                onChange={(event) => update('phone', event.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="field">
            <label>Preferred clinic</label>
            <select
              id="reg-clinic"
              value={form.preferredClinicId}
              onChange={(event) => update('preferredClinicId', event.target.value)}
              disabled={clinicsLoading}
            >
              <option value="">{clinicsLoading ? 'Loading clinics...' : 'Select a clinic'}</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              id="reg-email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              id="reg-pw"
              placeholder="Use uppercase, lowercase, number and symbol"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
              Use at least 8 characters with uppercase, lowercase, a number, and a special character.
            </div>
          </div>

          <div className="field">
            <label>Confirm password</label>
            <input
              type="password"
              id="reg-pw2"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={(event) => update('confirmPassword', event.target.value)}
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <div className="auth-switch">
            Already have an account? <Link href="/patient/login">Sign in</Link>
          </div>
        </form>
      </div>
      </div>
    </>
  );
}
