'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember } from '@/types';

interface NurseStats {
  total: number;
  waiting: number;
  seen: number;
  critical: number;
  avgWait: number;
}

interface NurseOverviewProps {
  staff: StaffMember;
  clockedIn: boolean;
  onGoToTriage: () => void;
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

function StatCards({ doctor, stats }: { doctor?: boolean; stats?: NurseStats | null }) {
  if (!doctor && stats && 'total' in stats) {
    const nurseStats = stats as NurseStats;
    const items = [['ti-users', String(nurseStats.total), 'Total queue', `${nurseStats.waiting} waiting`], ['ti-circle-check', String(nurseStats.seen), 'Triaged today', 'Completed'], ['ti-urgent', String(nurseStats.critical), 'Critical', 'Routed to doctor'], ['ti-clock-hour-4', formatWait(nurseStats.avgWait), 'Avg wait', 'Target 35 min']];
    return <div className="dg4">{items.map(([icon, value, label, detail]) => <div className="dg-c" key={label}><div className="dg-ic" style={{ background: icon === 'ti-urgent' ? 'var(--red-bg)' : icon === 'ti-clock-hour-4' ? 'var(--amb-bg)' : icon === 'ti-circle-check' ? 'var(--grn-bg)' : 'var(--teal-pale)' }}><i className={`ti ${icon}`} style={{ color: icon === 'ti-urgent' ? 'var(--red)' : icon === 'ti-clock-hour-4' ? 'var(--amber)' : icon === 'ti-circle-check' ? 'var(--green)' : 'var(--teal)' }}></i></div><div className="dg-v" style={icon === 'ti-urgent' ? { color: 'var(--red)' } : undefined}>{value}</div><div className="dg-l">{label}</div><div className="dg-d">{detail}</div></div>)}</div>;
  }
  const items = [['ti-users', '66', 'Total queue', '+8 since 14:00'], ['ti-circle-check', '48', 'Triaged today', '72% complete'], ['ti-urgent', '3', 'Critical', 'Routed to doctor'], ['ti-clock-hour-4', '~40m', 'Avg wait', 'Target 35 min']];
  return <div className="dg4">{items.map(([icon, value, label, detail]) => <div className="dg-c" key={label}><div className="dg-ic" style={{ background: icon === 'ti-urgent' ? 'var(--red-bg)' : icon === 'ti-clock-hour-4' || icon === 'ti-user-check' ? 'var(--amb-bg)' : icon === 'ti-circle-check' ? 'var(--grn-bg)' : 'var(--teal-pale)' }}><i className={`ti ${icon}`} style={{ color: icon === 'ti-urgent' ? 'var(--red)' : icon === 'ti-clock-hour-4' || icon === 'ti-user-check' ? 'var(--amber)' : icon === 'ti-circle-check' ? 'var(--green)' : 'var(--teal)' }}></i></div><div className="dg-v" style={icon === 'ti-urgent' ? { color: 'var(--red)' } : undefined}>{value}</div><div className="dg-l">{label}</div><div className="dg-d" style={detail.includes('complete') || detail.includes('list') ? { color: 'var(--green)' } : detail.includes('doctor') || detail.includes('Priority') ? { color: 'var(--red)' } : undefined}>{detail}</div></div>)}</div>;
}

export default function NurseOverview({ staff, clockedIn, onGoToTriage }: NurseOverviewProps) {
  const [doctorOnDuty, setDoctorOnDuty] = useState<{ name: string; time: string } | null>(null);
  const [nurseOnDuty, setNurseOnDuty] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NurseStats | null>(null);
  const [nextToTriage, setNextToTriage] = useState<Array<{ id: string; position: number; patient_name: string; joined_at: string; is_elderly: boolean }>>([]);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today)
      .eq('clinic_id', staff.clinic_id);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    let total = 0;
    let waiting = 0;
    let seen = 0;

    if (queueIds.length) {
      const { data: entryRows } = await supabase
        .from('queue_entries')
        .select('status')
        .in('queue_id', queueIds);

      ((entryRows ?? []) as Array<{ status: string }>).forEach((entry) => {
        if (entry.status !== 'skipped') total++;
        if (entry.status === 'waiting') waiting++;
        if (entry.status === 'seen') seen++;
      });
    }

    const { data: entryRowsForTriage } = await supabase
      .from('queue_entries')
      .select('id')
      .in('queue_id', queueIds);

    const entryIds = ((entryRowsForTriage ?? []) as Array<{ id: string }>).map((e) => e.id);

    let critical = 0;
    if (entryIds.length) {
      const { count: criticalCount } = await supabase
        .from('triage_records')
        .select('id', { count: 'exact', head: true })
        .in('queue_entry_id', entryIds)
        .eq('category', 'critical');
      critical = criticalCount ?? 0;
    }

    const avgWait = waiting > 0 ? (waiting * 2.5) : 0;

    setStats({ total, waiting, seen, critical, avgWait });
  }, [staff.clinic_id]);

  const fetchNextToTriage = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today)
      .eq('clinic_id', staff.clinic_id);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    if (!queueIds.length) {
      setNextToTriage([]);
      return;
    }

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id,position,patient_name,joined_at,is_elderly')
      .in('queue_id', queueIds)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(5);

    const entries = (entryRows ?? []) as Array<{ id: string; position: number; patient_name: string; joined_at: string; is_elderly: boolean }>;

    const { data: triageRows } = await supabase
      .from('triage_records')
      .select('queue_entry_id')
      .in('queue_entry_id', entries.map((e) => e.id));

    const triagedEntryIds = new Set((triageRows ?? []).map((t) => t.queue_entry_id));
    const untriaged = entries.filter((e) => !triagedEntryIds.has(e.id));

    setNextToTriage(untriaged);
  }, [staff.clinic_id]);

  useEffect(() => {
    const fetchClockIns = async () => {
      const supabase = createClient();
      const today = todayIsoDate();
      const { data, error } = await supabase
        .from('clock_ins')
        .select('staff_id,clocked_in_at,staff(name,role)')
        .eq('shift_date', today)
        .eq('clinic_id', staff.clinic_id);

      if (error) {
        setLoading(false);
        return;
      }

      const clockIns = (data ?? []) as Array<{ staff_id: string; clocked_in_at: string; staff: { name: string; role: string }[] } | null>;
      const doctor = clockIns.find((ci) => ci?.staff?.[0]?.role === 'doctor');
      const nurse = clockIns.find((ci) => ci?.staff?.[0]?.role === 'nurse');

      if (doctor && doctor.staff && doctor.staff[0]) {
        const time = new Date(doctor.clocked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setDoctorOnDuty({ name: doctor.staff[0].name, time });
      }
      if (nurse && nurse.staff && nurse.staff[0]) {
        const time = new Date(nurse.clocked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setNurseOnDuty({ name: nurse.staff[0].name, time });
      }
      setLoading(false);
    };
    void fetchClockIns();
    void fetchStats();
    void fetchNextToTriage();
    const interval = window.setInterval(fetchStats, 30000);
    return () => window.clearInterval(interval);
  }, [fetchStats, fetchNextToTriage]);

  return <div className="sv-v active" id="sv-overview"><StatCards stats={stats} />{loading ? <div className="alert al-a" id="dash-alert" style={{ marginBottom: '1rem' }}><i className="ti ti-loader"></i><div><div className="al-t">Loading staff status...</div></div></div> : doctorOnDuty ? <div className="alert al-g" id="dash-alert" style={{ marginBottom: '1rem' }}><i className="ti ti-check"></i><div><div className="al-t">Doctor on duty — {doctorOnDuty.name} clocked in at {doctorOnDuty.time}</div><div className="al-b">Consultation nurse clocked in. Patient-facing status updated.</div></div></div> : <div className="alert al-a" id="dash-alert" style={{ marginBottom: '1rem' }}><i className="ti ti-alert-triangle"></i><div><div className="al-t">No doctor on post yet — patients may face delays</div><div className="al-b">Doctor queue paused. Use Clock-In in the sidebar to resolve this.</div></div></div>}{nextToTriage.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>No patients awaiting triage</div> : <div className="tbl"><div className="tbl-hd"><span className="tbl-ht">Next to Triage</span><span className="tbl-hc">{nextToTriage.length} awaiting</span></div><div className="th" style={{ gridTemplateColumns: '40px 1fr 110px 90px 90px' }}><span>#</span><span>Patient</span><span>Joined</span><span>Elderly</span><span>Action</span></div>{nextToTriage.map((entry) => <div className="tr" style={{ gridTemplateColumns: '40px 1fr 110px 90px 90px' }} key={entry.id}><div style={{ fontWeight: 600, color: 'var(--muted)' }}>{entry.position}</div><div className="pc"><div className="in-av">{entry.patient_name.split(' ').map((part) => part[0]).join('')}</div><div><div className="pn">{entry.patient_name}</div></div></div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Arrived {new Date(entry.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div>{entry.is_elderly && <span className="tag te">Elderly</span>}</div><div><button style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 12px', font: "12px 'Inter',sans-serif", cursor: 'pointer' }} onClick={onGoToTriage}>Triage</button></div></div>)}</div>}</div>;
}
