'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember } from '@/types';

interface PatientsViewProps {
  staff: StaffMember;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function PatientsView({ staff }: PatientsViewProps) {
  const [patients, setPatients] = useState<Array<{ id: string; position: number; patient_name: string; status: string; is_elderly: boolean; triage_record: { category: string; symptoms: string[] } }>>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
      return;
    }

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id,position,patient_name,status,is_elderly')
      .in('queue_id', queueIds);

    const entries = (entryRows ?? []) as Array<{ id: string; position: number; patient_name: string; status: string; is_elderly: boolean }>;

    const { data: triageRows } = await supabase
      .from('triage_records')
      .select('queue_entry_id,category,symptoms')
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
      });

    setPatients(patientsWithTriage);
    setLoading(false);
  }, [staff.clinic_id]);

  const markSeen = async (entryId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'seen' })
      .eq('id', entryId);

    if (!error) {
      await fetchPatients();
    }
  };

  useEffect(() => {
    void fetchPatients();
  }, [fetchPatients]);

  return (
    <div className="sv-v active" id="sv-patients">
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading patients...</div>
      ) : patients.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No patients assigned yet</div>
      ) : (
        <div className="tbl">
          <div className="tbl-hd">
            <span className="tbl-ht">My Patients Today</span>
            <span className="tbl-hc">{patients.length} assigned</span>
          </div>
          <div className="th" style={{ gridTemplateColumns: '40px 1fr 120px 90px 90px 90px' }}>
            <span>#</span>
            <span>Patient</span>
            <span>Symptoms</span>
            <span>Category</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {patients.map((patient) => (
            <div className="tr" style={{ gridTemplateColumns: '40px 1fr 120px 90px 90px 90px' }} key={patient.id}>
              <div style={{ fontWeight: 600, color: 'var(--muted)' }}>{patient.position}</div>
              <div className="pc">
                <div className="in-av">{patient.patient_name.split(' ').map((part) => part[0]).join('')}</div>
                <div>
                  <div className="pn">{patient.patient_name}</div>
                  {patient.is_elderly && <span className="tag te" style={{ fontSize: 10, marginLeft: 4 }}>Elderly</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{patient.triage_record.symptoms.join(', ')}</div>
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
              <div>
                <button
                  style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 12px', font: "12px 'Inter',sans-serif", cursor: 'pointer' }}
                  onClick={() => markSeen(patient.id)}
                >
                  Mark seen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
