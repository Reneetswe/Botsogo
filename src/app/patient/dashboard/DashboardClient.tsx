'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import Alert from '@/components/Alert';
import MedicineSearch from '@/components/MedicineSearch';
import { createClient } from '@/lib/supabase/client';
import type { PatientProfile } from '@/types';

interface DashboardClientProps {
  profile: PatientProfile;
}

interface QueueRow {
  id: string;
  clinic_id: string;
}

interface QueueEntryRow {
  id: string;
  queue_id: string;
  patient_id: string;
  patient_name: string | null;
  position: number;
  status: string;
  joined_at: string;
}

interface ClinicRow {
  id: string;
  name: string;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface StaffRow {
  id: string;
  clinic_id: string;
}

interface ClockInRow {
  staff_id: string;
  clinic_id: string;
}

interface LiveClinicState extends ClinicRow {
  queueCount: number;
  doctorOnDuty: boolean;
  loadLevel: 'Low' | 'Medium' | 'High';
  estimatedWaitMinutes: number;
  distanceKm?: number;
}

interface ActiveQueueState {
  entry: QueueEntryRow;
  queue: QueueRow;
  clinic: ClinicRow;
  currentPosition: number;
  totalInQueue: number;
  triageRecord: { category: string; triaged_at: string } | null;
}

interface JoinSuccessState {
  clinicName: string;
  position: number;
  estimatedSlot: string;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatQueueNumber(position: number) {
  return `Q-${String(position).padStart(3, '0')}`;
}

function estimatedSlotFromNow(position: number) {
  const date = new Date(Date.now() + position * 2.5 * 60 * 1000);
  return `~${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function estimatedSlotFromJoinedAt(joinedAt: string, position: number) {
  const date = new Date(new Date(joinedAt).getTime() + position * 2.5 * 60 * 1000);
  return `~${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function getLoadLevel(count: number): LiveClinicState['loadLevel'] {
  if (count <= 30) return 'Low';
  if (count <= 65) return 'Medium';
  return 'High';
}

function getLoadClasses(level: LiveClinicState['loadLevel']) {
  if (level === 'Low') return { loadClass: 'll', numberClass: 'nl', color: 'var(--green)' };
  if (level === 'Medium') return { loadClass: 'lm', numberClass: 'nm', color: 'var(--amber)' };
  return { loadClass: 'lh', numberClass: 'nh', color: 'var(--red)' };
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function DashboardClient({ profile }: DashboardClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'home' | 'myqueue' | 'medicines'>('home');
  const [liveClinics, setLiveClinics] = useState<LiveClinicState[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  const [clinicsError, setClinicsError] = useState('');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationText, setLocationText] = useState('Use my location to sort by distance');
  const [sortMode, setSortMode] = useState<'nearest' | 'busy' | 'name'>('busy');
  const [joiningClinicId, setJoiningClinicId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState<JoinSuccessState | null>(null);
  const [queueState, setQueueState] = useState<ActiveQueueState | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [leftMessage, setLeftMessage] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [nurseOnDuty, setNurseOnDuty] = useState(false);
  const [doctorOnDuty, setDoctorOnDuty] = useState(false);
  const [staffStatusLoading, setStaffStatusLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationText('Geolocation not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocationEnabled(true);
        setLocationText('Showing clinics near your location');
        setSortMode('nearest');
      },
      () => {
        setLocationText('Could not get your location. Please try again.');
      }
    );
  };

  const fetchLiveClinics = useCallback(async () => {
    setClinicsLoading(true);
    setClinicsError('');
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: clinicRows, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, location, lat, lng')
      .order('name', { ascending: true });

    if (clinicError || !clinicRows) {
      setClinicsError('Unable to load clinic data. Please try again.');
      setClinicsLoading(false);
      return;
    }

    const clinicIds = clinicRows.map((c) => c.id);

    if (!clinicIds.length) {
      setLiveClinics([]);
      setClinicsLoading(false);
      return;
    }

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id, clinic_id')
      .eq('date', today)
      .in('clinic_id', clinicIds);

    const queues = queueRows ?? [];
    const queueIds = queues.map((q) => q.id);
    const queueClinicMap = new Map(queues.map((q) => [q.id, q.clinic_id]));
    const queueCountByClinic = new Map<string, number>();

    if (queueIds.length > 0) {
      const { data: entryRows } = await supabase
        .from('queue_entries')
        .select('queue_id')
        .eq('status', 'waiting')
        .in('queue_id', queueIds);

      for (const entry of entryRows ?? []) {
        const clinicId = queueClinicMap.get(entry.queue_id);
        if (clinicId) {
          queueCountByClinic.set(clinicId, (queueCountByClinic.get(clinicId) ?? 0) + 1);
        }
      }
    }

    const { data: doctorStaffRows } = await supabase
      .from('staff')
      .select('id, clinic_id')
      .eq('role', 'doctor')
      .in('clinic_id', clinicIds);

    const doctorStaffIds = (doctorStaffRows ?? []).map((s) => s.id);
    const doctorClinicIds = new Set<string>();

    if (doctorStaffIds.length > 0) {
      const { data: clockInRows } = await supabase
        .from('clock_ins')
        .select('staff_id, clinic_id')
        .eq('shift_date', today)
        .in('staff_id', doctorStaffIds);

      for (const ci of clockInRows ?? []) {
        doctorClinicIds.add(ci.clinic_id);
      }
    }

    const mapped = clinicRows.map((clinic) => {
      const queueCount = queueCountByClinic.get(clinic.id) ?? 0;
      const distanceKm =
        userLat !== null && userLng !== null
          ? haversine(userLat, userLng, clinic.lat, clinic.lng)
          : undefined;
      return {
        ...clinic,
        queueCount,
        doctorOnDuty: doctorClinicIds.has(clinic.id),
        loadLevel: getLoadLevel(queueCount),
        estimatedWaitMinutes: Math.round(queueCount * 2.5),
        distanceKm,
      };
    });

    setLiveClinics(mapped);
    setClinicsLoading(false);
  }, [userLat, userLng]);

  const fetchStaffStatus = useCallback(async () => {
    const targetClinicId = queueState?.queue.clinic_id;
    if (!targetClinicId) {
      setStaffStatusLoading(false);
      return;
    }
    setStaffStatusLoading(true);
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: clockInData } = await supabase
      .from('clock_ins')
      .select('staff_id,clinic_id,staff(role)')
      .eq('shift_date', today)
      .eq('clinic_id', targetClinicId);

    const clockIns = (clockInData ?? []) as Array<{ staff_id: string; clinic_id: string; staff: { role: string }[] } | null>;
    const nurseClockedIn = clockIns.some((ci) => ci?.staff?.[0]?.role === 'nurse');
    const doctorClockedIn = clockIns.some((ci) => ci?.staff?.[0]?.role === 'doctor');

    setNurseOnDuty(nurseClockedIn);
    setDoctorOnDuty(doctorClockedIn);
    setStaffStatusLoading(false);
  }, [queueState?.queue.clinic_id]);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError('');
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows, error: queuesError } = await supabase
      .from('queues')
      .select('id,clinic_id')
      .eq('date', today);

    if (queuesError) {
      setQueueError('Unable to load your queue. Please try again.');
      setQueueLoading(false);
      return;
    }

    const queues = (queueRows ?? []) as QueueRow[];
    const queueIds = queues.map((queue) => queue.id);

    if (!queueIds.length) {
      setQueueState(null);
      setQueueLoading(false);
      return;
    }

    const { data: entryRows, error: entryError } = await supabase
      .from('queue_entries')
      .select('id,queue_id,patient_id,patient_name,position,status,joined_at')
      .eq('patient_id', profile.id)
      .in('queue_id', queueIds)
      .in('status', ['waiting', 'called'])
      .order('joined_at', { ascending: false })
      .limit(1);

    if (entryError) {
      setQueueError('Unable to load your queue entry. Please try again.');
      setQueueLoading(false);
      return;
    }

    const entry = ((entryRows ?? []) as QueueEntryRow[])[0];
    if (!entry) {
      setQueueState(null);
      setQueueLoading(false);
      return;
    }

    const queue = queues.find((item) => item.id === entry.queue_id);
    if (!queue) {
      setQueueState(null);
      setQueueLoading(false);
      return;
    }

    const { data: clinicRow, error: clinicError } = await supabase
      .from('clinics')
      .select('id,name')
      .eq('id', queue.clinic_id)
      .single();

    if (clinicError || !clinicRow) {
      setQueueError('Unable to load clinic details. Please try again.');
      setQueueLoading(false);
      return;
    }

    const { count: totalCount } = await supabase
      .from('queue_entries')
      .select('id', { count: 'exact', head: true })
      .eq('queue_id', queue.id)
      .neq('status', 'skipped');

    const { count: aheadCount } = await supabase
      .from('queue_entries')
      .select('id', { count: 'exact', head: true })
      .eq('queue_id', queue.id)
      .eq('status', 'waiting')
      .lt('joined_at', entry.joined_at);

    const { data: triageRow } = await supabase
      .from('triage_records')
      .select('category, triaged_at')
      .eq('queue_entry_id', entry.id)
      .single();

    setQueueState({
      entry,
      queue,
      clinic: clinicRow as ClinicRow,
      currentPosition: (aheadCount ?? 0) + 1,
      totalInQueue: totalCount ?? 0,
      triageRecord: triageRow as { category: string; triaged_at: string } | null,
    });
    setQueueLoading(false);
  }, [profile.id]);

  const joinQueue = async (clinic: LiveClinicState) => {
    setJoinError('');
    setJoinSuccess(null);
    setJoiningClinicId(clinic.id);
    const supabase = createClient();
    const today = todayIsoDate();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;

    if (userError || !user) {
      setJoinError('Please sign in before joining a queue.');
      setJoiningClinicId(null);
      return;
    }

    const { data: todaysQueues } = await supabase
      .from('queues')
      .select('id,clinic_id')
      .eq('date', today);

    const queueIds = ((todaysQueues ?? []) as QueueRow[]).map((queue) => queue.id);

    if (queueIds.length) {
      const { data: activeEntries, error: activeError } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('patient_id', user.id)
        .in('queue_id', queueIds)
        .in('status', ['waiting', 'called'])
        .limit(1);

      if (activeError) {
        setJoinError('Unable to check your queue status. Please try again.');
        setJoiningClinicId(null);
        return;
      }

      if ((activeEntries ?? []).length > 0) {
        setJoinError('You are already in a queue today. Check your My Queue tab.');
        setJoiningClinicId(null);
        return;
      }
    }

    const { data: openQueues, error: openQueueError } = await supabase
      .from('queues')
      .select('id,clinic_id')
      .eq('clinic_id', clinic.id)
      .eq('date', today)
      .eq('status', 'open')
      .limit(1);

    if (openQueueError) {
      setJoinError('Unable to find today’s queue. Please try again.');
      setJoiningClinicId(null);
      return;
    }

    let queue = ((openQueues ?? []) as QueueRow[])[0];

    if (!queue) {
      const { data: createdQueue, error: createQueueError } = await supabase
        .from('queues')
        .insert({ clinic_id: clinic.id, date: today, status: 'open' })
        .select('id,clinic_id')
        .single();

      if (createQueueError || !createdQueue) {
        setJoinError('Unable to create today’s queue. Please try again.');
        setJoiningClinicId(null);
        return;
      }

      queue = createdQueue as QueueRow;
    }

    const { count, error: countError } = await supabase
      .from('queue_entries')
      .select('id', { count: 'exact', head: true })
      .eq('queue_id', queue.id)
      .neq('status', 'skipped');

    if (countError) {
      setJoinError('Unable to calculate your queue position. Please try again.');
      setJoiningClinicId(null);
      return;
    }

    const position = (count ?? 0) + 1;

    if (position > 100) {
      setJoinError('This clinic’s queue is full today. Please try another clinic.');
      setJoiningClinicId(null);
      return;
    }

    const { error: insertError } = await supabase
      .from('queue_entries')
      .insert({
        queue_id: queue.id,
        patient_id: user.id,
        patient_name: `${profile.fname} ${profile.lname}`,
        position,
        status: 'waiting',
        is_elderly: false,
        priority: false,
      });

    if (insertError) {
      setJoinError(insertError.message);
      setJoiningClinicId(null);
      return;
    }

    setJoinSuccess({ clinicName: clinic.name, position, estimatedSlot: estimatedSlotFromNow(position) });
    setJoiningClinicId(null);
    await fetchQueue();
    await fetchLiveClinics();
  };

  useEffect(() => {
    void fetchQueue();
    void fetchLiveClinics();
    void fetchStaffStatus();
  }, [fetchQueue, fetchLiveClinics, fetchStaffStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchStaffStatus();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [fetchStaffStatus]);

  useEffect(() => {
    if (tab === 'myqueue') void fetchQueue();
  }, [tab, fetchQueue]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('dashboard-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        void fetchQueue();
        void fetchLiveClinics();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchQueue, fetchLiveClinics]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('dashboard-clockins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clock_ins' }, () => {
        void fetchLiveClinics();
        void fetchStaffStatus();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchLiveClinics, fetchStaffStatus]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('triage-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'triage_records' }, () => {
        void fetchQueue();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  const leaveQueue = async () => {
    if (!queueState) return;
    setLeaving(true);
    setQueueError('');
    const supabase = createClient();
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'skipped' })
      .eq('id', queueState.entry.id)
      .eq('patient_id', profile.id);

    setLeaving(false);
    setConfirmLeave(false);

    if (error) {
      setQueueError('Unable to leave the queue. Please try again.');
      return;
    }

    setQueueState(null);
    setLeftMessage('You have left the queue');
  };

  const sortedClinics = useMemo(() => {
    const list = [...liveClinics];
    if (sortMode === 'nearest' && locationEnabled) {
      return list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    if (sortMode === 'busy') {
      return list.sort((a, b) => a.queueCount - b.queueCount);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [liveClinics, sortMode, locationEnabled]);

  const activeQueueClinic = queueState ? liveClinics.find((clinic) => clinic.id === queueState.queue.clinic_id) : null;

  return (
    <>
      <div className="screen active" id="screen-dash">
        <div className="dash-header"><div className="dash-header-left"><div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><h2 id="dash-greeting">{greeting}, {profile.fname}</h2><button className="btn-ghost" type="button" onClick={() => router.push('/patient/profile')}>My profile</button><button className="btn-ghost" type="button" onClick={signOut}>Sign out</button></div><p>Gaborone West Clinic &nbsp;·&nbsp; Active check-in</p></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Your slot</div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--teal)' }}>10:30 – 11:00</div></div></div>
        <div className="dash-tabs" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}><button className={`dtab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}><i className="ti ti-home"></i> Home</button><button className={`dtab ${tab === 'myqueue' ? 'active' : ''}`} onClick={() => setTab('myqueue')}><i className="ti ti-ticket"></i> My Queue</button><button className={`dtab ${tab === 'medicines' ? 'active' : ''}`} onClick={() => setTab('medicines')}><i className="ti ti-pill"></i> Medicines</button></div>
        {tab === 'home' && (
          <div className="dash-body" id="dv-home">
            {!activeQueueClinic ? null : staffStatusLoading ? <div style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: 13 }}>Loading staff status...</div> : nurseOnDuty && doctorOnDuty ? <Alert tone="g" icon="ti-check" title={`${activeQueueClinic.name} — all staff on post`} body="Normal service. Your clinic is fully staffed today." id="dash-home-alert" /> : !nurseOnDuty && doctorOnDuty ? <Alert tone="r" icon="ti-alert-triangle" title={`${activeQueueClinic.name} — consultation nurse not yet on post`} body="Consider checking another nearby clinic with full staffing." id="dash-home-alert" /> : nurseOnDuty && !doctorOnDuty ? <Alert tone="a" icon="ti-alert-triangle" title={`${activeQueueClinic.name} — no doctor on duty yet`} body="Nurse services available. Doctor not yet on post." id="dash-home-alert" /> : <Alert tone="r" icon="ti-alert-triangle" title={`${activeQueueClinic.name} — no staff on post yet`} body="No staff have clocked in today. Please check back later or visit another clinic." id="dash-home-alert" />}
            <div className="card-label" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>Nearby clinics — live status</div>
            <div className="loc-bar" onClick={getLocation}>
              <i className="ti ti-map-pin"></i>
              <span className="loc-text">{locationText}</span>
              <span className="loc-btn">{locationEnabled ? 'Located' : 'Enable'}</span>
            </div>
            {locationError && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{locationError}</div>}
            <div className="sort-row">
              <span className="section-label" style={{ alignSelf: 'center', margin: 0 }}>Sort by:</span>
              <button className={`flt ${sortMode === 'nearest' ? 'active' : ''}`} onClick={() => locationEnabled && setSortMode('nearest')} style={{ opacity: locationEnabled ? 1 : 0.4, cursor: locationEnabled ? 'pointer' : 'not-allowed' }}>Nearest</button>
              <button className={`flt ${sortMode === 'busy' ? 'active' : ''}`} onClick={() => setSortMode('busy')}>Least busy</button>
              <button className={`flt ${sortMode === 'name' ? 'active' : ''}`} onClick={() => setSortMode('name')}>Name</button>
            </div>
            {clinicsLoading && <div className="card" style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: 13 }}>Loading live clinic data...</div>}
            {clinicsError && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{clinicsError}</div>}
            {joinError && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{joinError}</div>}
            {joinSuccess && <div className="card" style={{ marginBottom: '1rem' }}><div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>You have joined the queue at {joinSuccess.clinicName}</div><div style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>{formatQueueNumber(joinSuccess.position)}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Position in queue: {joinSuccess.position}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Estimated slot time: {joinSuccess.estimatedSlot}</div><button className="btn-teal" type="button" onClick={() => setTab('myqueue')}>View my queue</button></div>}
            {!clinicsLoading && sortedClinics.map((clinic) => {
              const classes = getLoadClasses(clinic.loadLevel);
              return (
                <div className="clinic-row" key={clinic.id}>
                  <div>
                    <div className="cn">{clinic.name}</div>
                    <div className="post-ln"><span className={`dot ${clinic.doctorOnDuty ? 'don' : 'doff'}`}></span><span style={{ color: clinic.doctorOnDuty ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{clinic.doctorOnDuty ? 'Doctor on duty' : 'Nurse only'}</span></div>
                    <div className="cd"><i className="ti ti-clock" style={{ fontSize: 11 }}></i> Estimated wait: {formatWait(clinic.estimatedWaitMinutes)}</div>
                    {clinic.distanceKm !== undefined && <div className="cd"><i className="ti ti-map-pin" style={{ fontSize: 11 }}></i> {clinic.distanceKm.toFixed(1)} km away</div>}
                    <button className="btn-teal" type="button" onClick={() => joinQueue(clinic)} disabled={joiningClinicId === clinic.id} style={{ marginTop: 8 }}>{joiningClinicId === clinic.id ? 'Joining...' : 'Join queue'}</button>
                  </div>
                  <div className="load-w"><div style={{ fontSize: 11, color: classes.color, fontWeight: 600, marginBottom: 6 }}>{clinic.loadLevel}</div><div className="load-b"><div className={`lf ${classes.loadClass}`} style={{ width: `${Math.min(clinic.queueCount, 100)}%` }}></div></div><span className={`ln ${classes.numberClass}`}>{clinic.queueCount}/100</span></div>
                </div>
              );
            })}
            <div style={{ marginTop: '1.25rem', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }} className="card-label">Your position</div>
            <div className="mini3"><div className="mini-c"><div className="mc-val">{queueState ? queueState.entry.position : '—'}</div><div className="mc-lbl">Queue number</div></div><div className="mini-c"><div className="mc-val">{queueState ? estimatedSlotFromJoinedAt(queueState.entry.joined_at, queueState.currentPosition) : '—'}</div><div className="mc-lbl">Est. wait</div></div><div className="mini-c"><div className="mc-val">{queueState ? Math.max(queueState.currentPosition - 1, 0) : '—'}</div><div className="mc-lbl">Ahead of you</div></div></div>
            <Alert tone="g" icon="ti-device-mobile-message" title="SMS alerts are active" body="You will receive a text when 5 patients remain ahead of you." />
          </div>
        )}
        {tab === 'myqueue' && (
          <div className="dash-body" id="dv-myqueue">
            {queueLoading && <div className="card" style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: 13 }}>Loading your queue...</div>}
            {!queueLoading && queueError && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{queueError}</div>}
            {!queueLoading && !queueState && <div className="card" style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: 13 }}>{leftMessage || 'You are not currently in any queue today'}<div style={{ marginTop: 12 }}><button className="btn-teal" type="button" onClick={() => setTab('home')}>Find a clinic</button></div></div>}
            {!queueLoading && queueState && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}><div><div style={{ fontSize: 54, fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{queueState.entry.position}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{queueState.clinic.name}</div></div><div style={{ background: 'var(--teal-pale)', borderRadius: 'var(--r2)', padding: '.75rem 1rem', textAlign: 'right' }}><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--navy)' }}>{estimatedSlotFromJoinedAt(queueState.entry.joined_at, queueState.currentPosition)}</div><div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 2 }}>Estimated call time</div></div></div>
                <div className="prog"><div className="pf" style={{ width: `${Math.min((queueState.currentPosition / Math.max(queueState.totalInQueue, 1)) * 100, 100)}%` }}></div></div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{Math.max(queueState.currentPosition - 1, 0)} ahead &nbsp;·&nbsp; {queueState.totalInQueue} total in queue</div>
                <div className="card-label" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginTop: '1rem' }}>Your journey today</div>
                <div className="tl-item"><div className="tl-col"><div className="tl-d td-done"></div><div className="tl-ln"></div></div><div><div className="tl-text">Joined queue</div><div className="tl-s">{new Date(queueState.entry.joined_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div></div>
                <div className="tl-item"><div className="tl-col"><div className={`tl-d ${queueState.triageRecord ? 'td-done' : queueState.entry.status === 'waiting' ? 'td-now' : 'td-p'}`}></div><div className="tl-ln"></div></div><div><div className={`tl-text ${!queueState.triageRecord && queueState.entry.status !== 'waiting' ? 'dim' : ''}`} style={queueState.triageRecord ? undefined : queueState.entry.status === 'waiting' ? { color: 'var(--teal)' } : undefined}>Nurse triage</div><div className="tl-s">{queueState.triageRecord ? `Triaged — ${queueState.triageRecord.category} · routed to ${queueState.triageRecord.category === 'mild' ? 'nurse' : 'doctor'} queue · ${new Date(queueState.triageRecord.triaged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : queueState.entry.status === 'waiting' ? 'Awaiting triage on arrival' : ''}</div></div></div>
                <div className="tl-item"><div className="tl-col"><div className={`tl-d ${queueState.entry.status === 'seen' ? 'td-done' : queueState.triageRecord && (queueState.entry.status === 'waiting' || queueState.entry.status === 'called') ? 'td-now' : 'td-p'}`}></div><div className="tl-ln"></div></div><div><div className={`tl-text ${!queueState.triageRecord ? 'dim' : ''}`} style={queueState.triageRecord && (queueState.entry.status === 'waiting' || queueState.entry.status === 'called') ? { color: 'var(--teal)' } : undefined}>Waiting for consultation</div><div className="tl-s">{queueState.entry.status === 'seen' ? 'Ready for consultation' : queueState.triageRecord && (queueState.entry.status === 'waiting' || queueState.entry.status === 'called') ? `In queue · position ${queueState.currentPosition}` : ''}</div></div></div>
                <div className="tl-item"><div className="tl-col"><div className={`tl-d ${queueState.entry.status === 'seen' ? 'td-done' : 'td-p'}`}></div></div><div><div className={`tl-text ${queueState.entry.status !== 'seen' ? 'dim' : ''}`}>Consultation done</div><div className="tl-s">{queueState.entry.status === 'seen' ? 'Visit complete' : 'Pending'}</div></div></div>
                {confirmLeave ? <div style={{ marginTop: '1rem' }}><div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Are you sure you want to leave the queue?</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn-ghost" type="button" onClick={() => setConfirmLeave(false)}>Cancel</button><button className="btn-teal" type="button" onClick={leaveQueue} disabled={leaving}>{leaving ? 'Leaving...' : 'Yes, leave queue'}</button></div></div> : <button className="btn-ghost" type="button" onClick={() => setConfirmLeave(true)} style={{ marginTop: '1rem' }}>Leave queue</button>}
              </div>
            )}
            <Alert tone="g" icon="ti-bell" title="SMS updates active" body="You will get a text when 5 people remain ahead of you, and again when you are called." />
          </div>
        )}
        {tab === 'medicines' && (
          <div className="dash-body" id="dv-medicines">
            <div className="card">
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginBottom: '1rem' }}>Medicine Stock Search</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: '1rem' }}>Check which clinics have your medicine in stock before leaving home.</p>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <MedicineSearch embedded={true} />
            </div>
          </div>
        )}
        <Footer />
      </div>
    </>
  );
}
