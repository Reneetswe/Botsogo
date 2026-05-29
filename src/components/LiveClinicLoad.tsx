'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Clinic } from '@/types';

type LoadLevel = 'Low' | 'Medium' | 'High';
type SortMode = 'nearest' | 'least-busy' | 'name';

interface QueueRow {
  id: string;
  clinic_id: string;
}

interface QueueEntryRow {
  queue_id: string;
}

interface PatientQueueEntryRow {
  id: string;
}

interface ProfileRow {
  fname: string;
  lname: string;
}

interface StaffRow {
  id: string;
  clinic_id: string;
}

interface ClockInRow {
  staff_id: string;
  clinic_id: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface ClinicLoad extends Clinic {
  queueCount: number;
  doctorOnDuty: boolean;
  loadLevel: LoadLevel;
  estimatedWaitMinutes: number;
  distanceKm: number | null;
}

interface JoinSuccess {
  clinicName: string;
  position: number;
  estimatedSlot: string;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLoadLevel(count: number): LoadLevel {
  if (count <= 30) return 'Low';
  if (count <= 65) return 'Medium';
  return 'High';
}

function getLoadClasses(level: LoadLevel) {
  if (level === 'Low') return { loadClass: 'll', numberClass: 'nl', color: 'var(--green)' };
  if (level === 'Medium') return { loadClass: 'lm', numberClass: 'nm', color: 'var(--amber)' };
  return { loadClass: 'lh', numberClass: 'nh', color: 'var(--red)' };
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatQueueNumber(position: number) {
  return `Q-${String(position).padStart(3, '0')}`;
}

function formatEstimatedSlot(position: number) {
  const date = new Date(Date.now() + position * 2.5 * 60 * 1000);
  return `~${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function LiveClinicLoad() {
  const [clinics, setClinics] = useState<ClinicLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('least-busy');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [joiningClinicId, setJoiningClinicId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState<JoinSuccess | null>(null);

  const fetchClinicData = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: userData } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(userData.user));

    const { data: clinicRows, error: clinicsError } = await supabase
      .from('clinics')
      .select('id,name,location,lat,lng,created_at')
      .order('name', { ascending: true });

    if (clinicsError) {
      setError('Unable to load clinic data. Please try again later.');
      setLoading(false);
      return;
    }

    const typedClinics = (clinicRows ?? []) as Clinic[];
    const clinicIds = typedClinics.map((clinic) => clinic.id);

    if (!clinicIds.length) {
      setClinics([]);
      setLoading(false);
      return;
    }

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id,clinic_id')
      .eq('date', today)
      .in('clinic_id', clinicIds);

    const typedQueues = (queueRows ?? []) as QueueRow[];
    const queueIds = typedQueues.map((queue) => queue.id);

    const { data: entryRows } = queueIds.length
      ? await supabase
        .from('queue_entries')
        .select('queue_id')
        .eq('status', 'waiting')
        .in('queue_id', queueIds)
      : { data: [] };

    const typedEntries = (entryRows ?? []) as QueueEntryRow[];
    const queueClinicById = new Map(typedQueues.map((queue) => [queue.id, queue.clinic_id]));
    const queueCountByClinic = new Map<string, number>();

    typedEntries.forEach((entry) => {
      const clinicId = queueClinicById.get(entry.queue_id);
      if (clinicId) queueCountByClinic.set(clinicId, (queueCountByClinic.get(clinicId) ?? 0) + 1);
    });

    const { data: staffRows } = await supabase
      .from('staff')
      .select('id,clinic_id')
      .eq('role', 'doctor')
      .in('clinic_id', clinicIds);

    const typedStaff = (staffRows ?? []) as StaffRow[];
    const doctorStaffIds = typedStaff.map((staff) => staff.id);

    const { data: clockInRows } = doctorStaffIds.length
      ? await supabase
        .from('clock_ins')
        .select('staff_id,clinic_id')
        .eq('shift_date', today)
        .in('staff_id', doctorStaffIds)
        .in('clinic_id', clinicIds)
      : { data: [] };

    const typedClockIns = (clockInRows ?? []) as ClockInRow[];
    const doctorClinicIds = new Set(typedClockIns.map((clockIn) => clockIn.clinic_id));

    setClinics(typedClinics.map((clinic) => {
      const queueCount = queueCountByClinic.get(clinic.id) ?? 0;
      const distanceKm = coords && clinic.lat !== null && clinic.lng !== null
        ? haversine(coords.lat, coords.lng, clinic.lat, clinic.lng)
        : null;

      return {
        ...clinic,
        queueCount,
        doctorOnDuty: doctorClinicIds.has(clinic.id),
        loadLevel: getLoadLevel(queueCount),
        estimatedWaitMinutes: queueCount * 2.5,
        distanceKm,
      };
    }));
    setLoading(false);
  }, [coords]);

  useEffect(() => {
    void fetchClinicData();
  }, [fetchClinicData]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('clinic-load')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        void fetchClinicData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clock_ins' }, () => {
        void fetchClinicData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchClinicData]);

  const sortedClinics = useMemo(() => {
    return [...clinics].sort((left, right) => {
      if (sortMode === 'nearest' && coords) return (left.distanceKm ?? Number.MAX_VALUE) - (right.distanceKm ?? Number.MAX_VALUE);
      if (sortMode === 'name') return left.name.localeCompare(right.name);
      return left.queueCount - right.queueCount;
    });
  }, [clinics, coords, sortMode]);

  const useLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Location is not available on this device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationEnabled(true);
        setSortMode('nearest');
      },
      () => setLocationError('Unable to access your location. Please allow location access and try again.'),
    );
  };

  const joinQueue = async (clinic: ClinicLoad) => {
    setJoinError('');
    setJoinSuccess(null);
    setJoiningClinicId(clinic.id);

    const supabase = createClient();
    const today = todayIsoDate();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;

    if (userError || !user) {
      setJoinError('Please log in before joining a queue.');
      setJoiningClinicId(null);
      return;
    }

    const { data: todaysQueues } = await supabase
      .from('queues')
      .select('id,clinic_id')
      .eq('date', today);

    const activeQueueIds = ((todaysQueues ?? []) as QueueRow[]).map((queue) => queue.id);

    if (activeQueueIds.length) {
      const { data: activeEntries, error: activeError } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('patient_id', user.id)
        .in('queue_id', activeQueueIds)
        .in('status', ['waiting', 'called'])
        .limit(1);

      if (activeError) {
        setJoinError('Unable to check your queue status. Please try again.');
        setJoiningClinicId(null);
        return;
      }

      if (((activeEntries ?? []) as PatientQueueEntryRow[]).length > 0) {
        setJoinError('You are already in a queue today. Check your dashboard to see your position.');
        setJoiningClinicId(null);
        return;
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fname,lname')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setJoinError('Unable to load your profile. Please try again.');
      setJoiningClinicId(null);
      return;
    }

    const { data: openQueues, error: queueLookupError } = await supabase
      .from('queues')
      .select('id,clinic_id')
      .eq('clinic_id', clinic.id)
      .eq('date', today)
      .eq('status', 'open')
      .limit(1);

    if (queueLookupError) {
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

    const typedProfile = profile as ProfileRow;
    const { error: insertError } = await supabase
      .from('queue_entries')
      .insert({
        queue_id: queue.id,
        patient_id: user.id,
        patient_name: `${typedProfile.fname} ${typedProfile.lname}`,
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

    setJoinSuccess({ clinicName: clinic.name, position, estimatedSlot: formatEstimatedSlot(position) });
    setJoiningClinicId(null);
    void fetchClinicData();
  };

  return (
    <div className="section" id="clinics-info">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div className="section-title">Live clinic load</div>
        <div className="section-sub">See nearby clinic queues, doctor availability, and estimated waiting time before you leave home.</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn-ghost" type="button" onClick={useLocation}><i className="ti ti-current-location"></i> Use my location</button>
        <button className="btn-ghost" type="button" disabled={!coords} onClick={() => setSortMode('nearest')}>Nearest</button>
        <button className="btn-ghost" type="button" onClick={() => setSortMode('least-busy')}>Least busy</button>
        <button className="btn-ghost" type="button" onClick={() => setSortMode('name')}>Name</button>
      </div>

      {locationError && <div className="auth-err" style={{ display: 'block', margin: '0 auto 1rem', maxWidth: 680 }}>{locationError}</div>}
      {error && <div className="auth-err" style={{ display: 'block', margin: '0 auto 1rem', maxWidth: 680 }}>{error}</div>}
      {joinError && <div className="auth-err" style={{ display: 'block', margin: '0 auto 1rem', maxWidth: 680 }}>{joinError}</div>}
      {joinSuccess && <div className="card" style={{ margin: '0 auto 1rem', maxWidth: 680 }}><div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>You have joined the queue at {joinSuccess.clinicName}</div><div style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>{formatQueueNumber(joinSuccess.position)}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>You are number {joinSuccess.position} in the queue</div><div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Estimated slot time: {joinSuccess.estimatedSlot}</div><Link className="btn-teal" href="/dashboard">View my queue</Link></div>}
      {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading live clinic data...</div>}
      {!loading && !sortedClinics.length && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No clinics available right now. Please try again later.</div>}

      {!loading && sortedClinics.length > 0 && (
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gap: 10 }}>
          {sortedClinics.map((clinic) => {
            const classes = getLoadClasses(clinic.loadLevel);
            const fillWidth = `${Math.min(clinic.queueCount, 100)}%`;
            const joinQueueButton = <button className="btn-teal" type="button" onClick={() => joinQueue(clinic)} disabled={joiningClinicId === clinic.id}>{joiningClinicId === clinic.id ? 'Joining...' : 'Join queue'}</button>;

            return (
              <div className="clinic-row" key={clinic.id}>
                <div>
                  <div className="cn">{clinic.name}</div>
                  <div className="post-ln"><span className={`dot ${clinic.doctorOnDuty ? 'don' : 'doff'}`}></span><span style={{ color: clinic.doctorOnDuty ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{clinic.doctorOnDuty ? 'Doctor on duty' : 'Nurse only'}</span></div>
                  <div className="cd"><i className="ti ti-clock" style={{ fontSize: 11 }}></i> Estimated wait: {formatWait(clinic.estimatedWaitMinutes)}</div>
                  {clinic.distanceKm !== null && <div className="cd"><i className="ti ti-map-pin" style={{ fontSize: 11 }}></i> {clinic.distanceKm.toFixed(1)} km away</div>}
                  <div style={{ marginTop: 8 }}>{isLoggedIn ? joinQueueButton : <Link className="btn-teal" href="/patient/login">Sign in to join</Link>}</div>
                </div>
                <div className="load-w">
                  <div style={{ fontSize: 11, color: classes.color, fontWeight: 600, marginBottom: 6 }}>{clinic.loadLevel}</div>
                  <div className="load-b"><div className={`lf ${classes.loadClass}`} style={{ width: fillWidth }}></div></div>
                  <span className={`ln ${classes.numberClass}`}>{clinic.queueCount}/100</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
