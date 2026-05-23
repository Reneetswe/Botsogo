'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ConsultsView() {
  const [consults, setConsults] = useState<Array<{ id: string; position: number; patient_name: string; joined_at: string; symptoms: string[] }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchConsults = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    if (!queueIds.length) {
      setConsults([]);
      setLoading(false);
      return;
    }

    const { data: triageRows } = await supabase
      .from('triage_records')
      .select('queue_entry_id,symptoms')
      .in('category', ['critical', 'moderate']);

    const triageEntryIds = new Set((triageRows ?? []).map((t) => t.queue_entry_id));
    const triageMap = new Map((triageRows ?? []).map((t) => [t.queue_entry_id, t]));

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id,position,patient_name,joined_at')
      .in('id', Array.from(triageEntryIds))
      .eq('status', 'seen')
      .order('joined_at', { ascending: false });

    const entries = (entryRows ?? []) as Array<{ id: string; position: number; patient_name: string; joined_at: string }>;

    const consults = entries.map((e) => ({
      ...e,
      symptoms: triageMap.get(e.id)?.symptoms ?? [],
    }));

    setConsults(consults);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchConsults();
  }, [fetchConsults]);

  return (
    <div className="sv-v active" id="sv-consults">
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading consultations...</div>
      ) : consults.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No consultations recorded yet today</div>
      ) : (
        <div className="tbl">
          <div className="tbl-hd">
            <span className="tbl-ht">Consultation Log — Today</span>
            <span className="tbl-hc">{consults.length} completed</span>
          </div>
          <div className="th" style={{ gridTemplateColumns: '40px 1fr 80px 150px 80px' }}>
            <span>#</span>
            <span>Patient</span>
            <span>Time</span>
            <span>Outcome</span>
            <span>Status</span>
          </div>
          {consults.map((consult) => (
            <div className="tr" style={{ gridTemplateColumns: '40px 1fr 80px 150px 80px' }} key={consult.id}>
              <div style={{ fontWeight: 600, color: 'var(--muted)' }}>{consult.position}</div>
              <div className="pc">
                <div className="in-av">{consult.patient_name.split(' ').map((part) => part[0]).join('')}</div>
                <div>
                  <div className="pn">{consult.patient_name}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(consult.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div style={{ fontSize: 12 }}>{consult.symptoms.join(', ')}</div>
              <div><span className="tag tg">Completed</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
