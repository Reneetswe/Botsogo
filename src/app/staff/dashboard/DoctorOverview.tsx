'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember } from '@/types';

interface DoctorStats {
  assigned: number;
  seen: number;
  critical: number;
  pending: number;
  inConsultation: number;
}

interface DoctorOverviewProps {
  staff: StaffMember;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function StatCards({ doctor, stats }: { doctor?: boolean; stats?: DoctorStats | null }) {
  if (doctor && stats && 'assigned' in stats) {
    const doctorStats = stats as DoctorStats;
    const items = [['ti-stethoscope', String(doctorStats.assigned), 'Assigned to me', `${doctorStats.pending} remaining`], ['ti-circle-check', String(doctorStats.seen), 'Done today', 'Completed'], ['ti-urgent', String(doctorStats.critical), 'Critical', 'Priority queue'], ['ti-user-check', String(doctorStats.inConsultation), 'In consultation', 'Active']];
    return <div className="dg4">{items.map(([icon, value, label, detail]) => <div className="dg-c" key={label}><div className="dg-ic" style={{ background: icon === 'ti-urgent' ? 'var(--red-bg)' : icon === 'ti-user-check' ? 'var(--amb-bg)' : icon === 'ti-circle-check' ? 'var(--grn-bg)' : 'var(--teal-pale)' }}><i className={`ti ${icon}`} style={{ color: icon === 'ti-urgent' ? 'var(--red)' : icon === 'ti-user-check' ? 'var(--amber)' : icon === 'ti-circle-check' ? 'var(--green)' : 'var(--teal)' }}></i></div><div className="dg-v" style={icon === 'ti-urgent' ? { color: 'var(--red)' } : undefined}>{value}</div><div className="dg-l">{label}</div><div className="dg-d">{detail}</div></div>)}</div>;
  }
  const items = [['ti-stethoscope', '14', 'Assigned to me', '6 remaining'], ['ti-circle-check', '8', 'Done today', '57% of list'], ['ti-urgent', '3', 'Critical', 'Priority queue'], ['ti-user-check', '1', 'In consultation', 'Since 14:06']];
  return <div className="dg4">{items.map(([icon, value, label, detail]) => <div className="dg-c" key={label}><div className="dg-ic" style={{ background: icon === 'ti-urgent' ? 'var(--red-bg)' : icon === 'ti-clock-hour-4' || icon === 'ti-user-check' ? 'var(--amb-bg)' : icon === 'ti-circle-check' ? 'var(--grn-bg)' : 'var(--teal-pale)' }}><i className={`ti ${icon}`} style={{ color: icon === 'ti-urgent' ? 'var(--red)' : icon === 'ti-clock-hour-4' || icon === 'ti-user-check' ? 'var(--amber)' : icon === 'ti-circle-check' ? 'var(--green)' : 'var(--teal)' }}></i></div><div className="dg-v" style={icon === 'ti-urgent' ? { color: 'var(--red)' } : undefined}>{value}</div><div className="dg-l">{label}</div><div className="dg-d" style={detail.includes('complete') || detail.includes('list') ? { color: 'var(--green)' } : detail.includes('doctor') || detail.includes('Priority') ? { color: 'var(--red)' } : undefined}>{detail}</div></div>)}</div>;
}

export default function DoctorOverview({ staff }: DoctorOverviewProps) {
  const [nurseOnDuty, setNurseOnDuty] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [patients, setPatients] = useState<Array<{ id: string; position: number; patient_name: string; status: string; is_elderly: boolean; triage_record: { category: string } }>>([]);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today)
      .eq('clinic_id', staff.clinic_id);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id')
      .in('queue_id', queueIds);

    const entryIds = ((entryRows ?? []) as Array<{ id: string }>).map((e) => e.id);

    let assigned = 0;
    let critical = 0;
    if (entryIds.length) {
      const { count: assignedCount } = await supabase
        .from('triage_records')
        .select('id', { count: 'exact', head: true })
        .in('queue_entry_id', entryIds)
        .in('category', ['critical', 'moderate']);
      assigned = assignedCount ?? 0;

      const { count: criticalCount } = await supabase
        .from('triage_records')
        .select('id', { count: 'exact', head: true })
        .in('queue_entry_id', entryIds)
        .eq('category', 'critical');
      critical = criticalCount ?? 0;
    }

    let seen = 0;
    if (entryIds.length) {
      const { data: triageRows } = await supabase
        .from('triage_records')
        .select('queue_entry_id')
        .in('queue_entry_id', entryIds)
        .in('category', ['critical', 'moderate']);

      const doctorTriageEntryIds = new Set((triageRows ?? []).map((t) => t.queue_entry_id));

      const { data: entryRows } = await supabase
        .from('queue_entries')
        .select('id,status')
        .in('queue_id', queueIds);

      ((entryRows ?? []) as Array<{ id: string; status: string }>).forEach((entry) => {
        if (entry.status === 'seen' && doctorTriageEntryIds.has(entry.id)) seen++;
      });
    }

    const pending = assigned - seen;
    const inConsultation = 0;

    setStats({ assigned, seen, critical, pending, inConsultation });
  }, [staff.clinic_id]);

  const fetchPatients = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today)
      .eq('clinic_id', staff.clinic_id);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    if (!queueIds.length) {
      setPatients([]);
      return;
    }

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id,position,patient_name,status,is_elderly')
      .in('queue_id', queueIds);

    const entries = (entryRows ?? []) as Array<{ id: string; position: number; patient_name: string; status: string; is_elderly: boolean }>;

    const { data: triageRows } = await supabase
      .from('triage_records')
      .select('queue_entry_id,category')
      .in('queue_entry_id', entries.map((e) => e.id))
      .in('category', ['critical', 'moderate']);

    const triageMap = new Map((triageRows ?? []).map((t) => [t.queue_entry_id, t]));

    const patientsWithTriage = entries
      .filter((e) => triageMap.has(e.id))
      .map((e) => ({
        ...e,
        triage_record: triageMap.get(e.id)!,
      }))
      .sort((a, b) => {
        if (a.triage_record.category === 'critical' && b.triage_record.category !== 'critical') return -1;
        if (a.triage_record.category !== 'critical' && b.triage_record.category === 'critical') return 1;
        if (a.is_elderly && !b.is_elderly) return -1;
        if (!a.is_elderly && b.is_elderly) return 1;
        return a.position - b.position;
      })
      .slice(0, 5);

    setPatients(patientsWithTriage);
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
      const nurse = clockIns.find((ci) => ci?.staff?.[0]?.role === 'nurse');

      if (nurse && nurse.staff && nurse.staff[0]) {
        const time = new Date(nurse.clocked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setNurseOnDuty({ name: nurse.staff[0].name, time });
      }
      setLoading(false);
    };
    void fetchClockIns();
    void fetchStats();
    void fetchPatients();
    const interval = window.setInterval(fetchStats, 30000);
    return () => window.clearInterval(interval);
  }, [fetchStats, fetchPatients]);

  return (
    <div className="sv-v active" id="sv-overview">
      <StatCards doctor stats={stats} />
      {loading ? (
        <div className="alert al-a" id="dash-alert" style={{ marginBottom: '1rem' }}>
          <i className="ti ti-loader"></i>
          <div>
            <div className="al-t">Loading staff status...</div>
          </div>
        </div>
      ) : nurseOnDuty ? (
        <div className="alert al-g" id="dash-alert" style={{ marginBottom: '1rem' }}>
          <i className="ti ti-check"></i>
          <div>
            <div className="al-t">Nurse on duty — {nurseOnDuty.name} clocked in at {nurseOnDuty.time}</div>
            <div className="al-b">Triage queue active. Patients are being processed.</div>
          </div>
        </div>
      ) : (
        <div className="alert al-a" id="dash-alert" style={{ marginBottom: '1rem' }}>
          <i className="ti ti-alert-triangle"></i>
          <div>
            <div className="al-t">No nurse on post yet — triage paused</div>
            <div className="al-b">Nurse queue paused. Use Clock-In in the sidebar to resolve this.</div>
          </div>
        </div>
      )}
      {patients.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No patients assigned yet</div>
      ) : (
        <div className="tbl">
          <div className="tbl-hd">
            <span className="tbl-ht">My Patient List — Today</span>
            <span className="tbl-hc">{patients.length} assigned</span>
          </div>
          <div className="th" style={{ gridTemplateColumns: '40px 1fr 90px 90px' }}>
            <span>#</span>
            <span>Patient</span>
            <span>Category</span>
            <span>Status</span>
          </div>
          {patients.map((patient) => (
            <div className="tr" style={{ gridTemplateColumns: '40px 1fr 90px 90px' }} key={patient.id}>
              <div style={{ fontWeight: 600, color: 'var(--muted)' }}>{patient.position}</div>
              <div className="pc">
                <div className="in-av">{patient.patient_name.split(' ').map((part) => part[0]).join('')}</div>
                <div>
                  <div className="pn">{patient.patient_name}</div>
                  {patient.is_elderly && <span className="tag te" style={{ fontSize: 10, marginLeft: 4 }}>Elderly</span>}
                </div>
              </div>
              <div>
                <span className={`tag ${patient.triage_record.category === 'critical' ? 'tc' : 'tm'}`}>
                  {patient.triage_record.category}
                </span>
              </div>
              <div>
                <span className={`tag ${patient.status === 'waiting' ? 'ta' : patient.status === 'called' ? 'tr' : 'tg'}`}>
                  {patient.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
