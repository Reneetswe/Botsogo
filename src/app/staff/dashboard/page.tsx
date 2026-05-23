'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_NAV, staffViewTitles } from '@/lib/data';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember, StaffView } from '@/types';
import NurseOverview from './NurseOverview';
import DoctorOverview from './DoctorOverview';
import QueueView from './QueueView';
import TriageView from './TriageView';
import PatientsView from './PatientsView';
import ConsultsView from './ConsultsView';
import ClockInView from './ClockInView';

function clockTime() {
  const date = new Date();
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

interface NurseStats {
  total: number;
  waiting: number;
  seen: number;
  critical: number;
  avgWait: number;
}

interface DoctorStats {
  assigned: number;
  seen: number;
  critical: number;
  pending: number;
  inConsultation: number;
}

export default function StaffDashboardPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [view, setView] = useState<StaffView>('overview');
  const [time, setTime] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockedInAt, setClockedInAt] = useState<string | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockInError, setClockInError] = useState('');

  const checkClockIn = useCallback(async () => {
    if (!staff) return;
    const supabase = createClient();
    const today = todayIsoDate();
    const { data, error } = await supabase
      .from('clock_ins')
      .select('id,clocked_in_at')
      .eq('staff_id', staff.id)
      .eq('shift_date', today)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      setClockInError('Unable to check clock-in status. Please try again.');
      return;
    }

    if (data) {
      setClockedIn(true);
      setClockedInAt(data.clocked_in_at);
    } else {
      setClockedIn(false);
      setClockedInAt(null);
    }
  }, [staff?.id]);

  const handleClockIn = async () => {
    if (!staff) return;
    setClockingIn(true);
    setClockInError('');
    const supabase = createClient();
    const today = todayIsoDate();
    const { error } = await supabase
      .from('clock_ins')
      .insert({
        staff_id: staff.id,
        clinic_id: staff.clinic_id,
        clocked_in_at: new Date().toISOString(),
        shift_date: today,
      });

    setClockingIn(false);

    if (error) {
      setClockInError(error.message);
      return;
    }

    await checkClockIn();
  };

  useEffect(() => {
    const staffCookie = document.cookie.split('; ').find((row) => row.startsWith('botsogo_staff='));
    const id = staffCookie?.split('=')[1];
    if (!id) {
      router.push('/staff/login');
      return;
    }
    const fetchStaff = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        router.push('/staff/login');
        return;
      }
      setStaff(data as StaffMember);
    };
    void fetchStaff();
    const update = () => setTime(clockTime());
    update();
    const interval = window.setInterval(update, 10000);
    return () => window.clearInterval(interval);
  }, [router]);

  useEffect(() => {
    void checkClockIn();
  }, [checkClockIn]);

  const signOut = () => {
    document.cookie = 'botsogo_staff=; path=/; max-age=0; SameSite=Lax';
    router.push('/staff/login');
  };

  const selectView = (nextView: StaffView) => {
    setView(nextView);
    setSidebarOpen(false);
  };

  return (
    <div className="screen active" id="screen-staff-dash">
      <style>{`
        .staff-mobile-topbar { display: none; background: #fff; border-bottom: 1px solid var(--border); padding: .75rem 1rem; align-items: center; justify-content: center; position: relative; flex-shrink: 0; }
        .staff-mobile-menu-btn { position: absolute; left: 1rem; background: #fff; border: 1px solid var(--border); color: var(--navy); border-radius: var(--r); width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .staff-mobile-menu-btn i { font-size: 20px; }
        .staff-mobile-logo { display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 8px; padding: 5px; }
        .staff-mobile-logo img { height: 34px; width: auto; }
        .staff-mobile-overlay { display: none; }
        @media (max-width: 700px) {
          .staff-mobile-topbar { display: flex; }
          .staff-mobile-overlay.open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 90; }
          .staff-sidebar.staff-sidebar-mobile-open { display: flex; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; height: 100vh; box-shadow: var(--shadow); }
        }
      `}</style>
      {!staff ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>Loading...</div> : <div className="staff-layout">
        <div className={`staff-mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        <aside className={`staff-sidebar ${sidebarOpen ? 'staff-sidebar-mobile-open' : ''}`}>
          <div className="sb-logo"><div className="sb-logo-wrap"><img src="/Justlogo.png" alt="Botsogo" /></div><div className="sb-brand"><div className="sb-brand-name">Botsogo</div><div className="sb-brand-sub">Staff Portal</div></div></div>
          <div className="sb-nav" id="sb-nav"><div className="sb-sect">Navigation</div>{ROLE_NAV[staff.role].map((item) => <button className={`sb-it ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => selectView(item.id)}><i className={`ti ${item.icon}`}></i>{item.label}</button>)}</div>
          <div className="sb-foot"><div className="sb-role"><div className="sr-lab">Signed in as</div><div className="sr-nm" id="sd-name">{staff.name}</div><div className="sr-pt" id="sd-post">{staff.post} Â· Gaborone West</div></div><button className="sb-so" onClick={signOut}><i className="ti ti-logout"></i>Sign out</button></div>
        </aside>
        <div className="staff-main">
          <div className="staff-mobile-topbar"><button className="staff-mobile-menu-btn" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open staff menu"><i className="ti ti-menu-2"></i></button><div className="staff-mobile-logo"><img src="/Justlogo.png" alt="Botsogo" /></div></div>
          <div className="staff-topbar"><div className="stb-l"><h3 id="stb-title">{staffViewTitles[view]}</h3><p>Gaborone West Clinic &nbsp;Â·&nbsp; <span id="stb-role-label">{staff.role === 'nurse' ? 'Nurse View' : 'Doctor View'}</span></p></div><div className="stb-r"><div className="live-b">Live</div><div className="stb-clk" id="sd-clk">{time}</div></div></div>
          <div className="staff-content">
            {view === 'overview' && (staff.role === 'nurse' ? <NurseOverview staff={staff} clockedIn={clockedIn} onGoToTriage={() => selectView('triage')} /> : <DoctorOverview staff={staff} />)}
            {view === 'queue' && <QueueView staff={staff} />}
            {view === 'triage' && <TriageView staff={staff} />}
            {view === 'patients' && <PatientsView staff={staff} />}
            {view === 'consults' && <ConsultsView />}
            {view === 'clockin' && <ClockInView staff={staff} time={time} clockedIn={clockedIn} clockedInAt={clockedInAt} clockingIn={clockingIn} clockInError={clockInError} onClockIn={handleClockIn} />}
          </div>
        </div>
      </div>}
    </div>
  );
}
