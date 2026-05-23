'use client';

import Link from 'next/link';
import { useState } from 'react';

interface NavbarClientProps {
  firstName?: string;
}

export default function NavbarClient(_props: NavbarClientProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <>
      <style>{`
        .public-mobile-menu-btn { display: none; background: #fff; border: 1px solid var(--border); color: var(--navy); border-radius: var(--r); width: 38px; height: 38px; align-items: center; justify-content: center; cursor: pointer; }
        .public-mobile-menu-btn i { font-size: 20px; }
        .public-mobile-dropdown { display: none; position: absolute; left: 1rem; right: 1rem; top: 68px; background: #fff; border: 1px solid var(--border); border-radius: var(--r2); box-shadow: var(--shadow); padding: .75rem; z-index: 50; }
        .public-mobile-dropdown.open { display: grid; gap: 8px; }
        .public-mobile-dropdown .nav-link, .public-mobile-dropdown .btn-ghost, .public-mobile-dropdown .btn-teal { width: 100%; justify-content: center; color: var(--navy); }
        @media (max-width: 700px) {
          .public-mobile-menu-btn { display: inline-flex; }
          .main-nav { position: relative; }
        }
      `}</style>
      <nav className="main-nav">
        <Link href="/" className="nav-logo" onClick={() => setMobileOpen(false)}>
          <img src="/Justlogo.png" alt="Botsogo" className="nav-logo-img" />
          <div className="nav-brand">
            <div className="nav-brand-name">Botsogo</div>
            <div className="nav-brand-sub">Because your time matters too</div>
          </div>
        </Link>
        <div className="nav-mid" id="nav-public">
          <button className="nav-link" onClick={() => scrollToSection('features')}>How It Works</button>
          <button className="nav-link" onClick={() => scrollToSection('clinics-info')}>Clinics</button>
          <button className="nav-link" onClick={() => scrollToSection('about')}>About</button>
        </div>
        <div className="nav-right" id="nav-auth-btns">
          <Link className="btn-ghost" href="/login">Login</Link>
          <Link className="btn-teal" href="/register">Register</Link>
          <button className="public-mobile-menu-btn" type="button" onClick={() => setMobileOpen((current) => !current)} aria-label="Open menu">
            <i className="ti ti-menu-2"></i>
          </button>
        </div>
        <div className={`public-mobile-dropdown ${mobileOpen ? 'open' : ''}`}>
          <button className="nav-link" onClick={() => scrollToSection('features')}>How It Works</button>
          <button className="nav-link" onClick={() => scrollToSection('clinics-info')}>Clinics</button>
          <button className="nav-link" onClick={() => scrollToSection('about')}>About</button>
          <Link className="btn-ghost" href="/login" onClick={() => setMobileOpen(false)}>Login</Link>
          <Link className="btn-teal" href="/register" onClick={() => setMobileOpen(false)}>Register</Link>
        </div>
      </nav>
    </>
  );
}
