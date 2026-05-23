'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember } from '@/types';

interface QueueViewProps {
  staff: StaffMember;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

export default function QueueView({ staff }: QueueViewProps) {
  const [entries, setEntries] = useState<Array<{ id: string; position: number; patient_name: string; status: string; is_elderly: boolean; triage_record?: { category: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const windowWidth = useWindowWidth();

  const fetchQueue = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today)
      .eq('clinic_id', staff.clinic_id);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    if (!queueIds.length) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id,position,patient_name,status,is_elderly')
      .in('queue_id', queueIds)
      .order('position', { ascending: true });

    const entries = (entryRows ?? []) as Array<{ id: string; position: number; patient_name: string; status: string; is_elderly: boolean }>;

    const { data: triageRows } = await supabase
      .from('triage_records')
      .select('queue_entry_id,category')
      .in('queue_entry_id', entries.map((e) => e.id));

    const triageMap = new Map((triageRows ?? []).map((t) => [t.queue_entry_id, t]));

    const entriesWithTriage = entries.map((e) => ({
      ...e,
      triage_record: triageMap.get(e.id),
    }));

    setEntries(entriesWithTriage);
    setLoading(false);
  }, [staff.clinic_id]);

  const markSeen = async (entryId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'seen' })
      .eq('id', entryId);

    if (!error) {
      await fetchQueue();
    }
  };

  useEffect(() => {
    void fetchQueue();
    const interval = window.setInterval(fetchQueue, 30000);
    return () => window.clearInterval(interval);
  }, [fetchQueue]);

  return (
    <div className="sv-v active" id="sv-queue">
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading queue...</div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No patients in queue yet today</div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', fontSize: 13, color: 'var(--muted)' }}>
            {entries.length} patients in queue today
          </div>
          {windowWidth < 700 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {entries.map((entry) => (
                <div key={entry.id} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>#{entry.position}</div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{entry.patient_name}</div>
                  </div>
                  {entry.triage_record ? (
                    <span className={`tag ${entry.triage_record.category === 'critical' ? 'tc' : entry.triage_record.category === 'moderate' ? 'tm' : 'tmi'}`} style={{ alignSelf: 'flex-start' }}>
                      {entry.triage_record.category}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Not triaged</span>
                  )}
                  <button
                    style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 12px', font: "12px 'Inter',sans-serif", cursor: 'pointer', alignSelf: 'flex-start' }}
                    onClick={() => markSeen(entry.id)}
                  >
                    Mark seen
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="tbl">
              <div className="tbl-hd">
                <span className="tbl-ht">Full Patient Queue</span>
                <span className="tbl-hc">{entries.length} total</span>
              </div>
              <div className="th" style={{ gridTemplateColumns: '40px 1fr 100px 90px 90px 90px' }}>
                <span>#</span>
                <span>Patient</span>
                <span>Triage</span>
                <span>Elderly</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              {entries.map((entry) => (
                <div className="tr" style={{ gridTemplateColumns: '40px 1fr 100px 90px 90px 90px' }} key={entry.id}>
                  <div style={{ fontWeight: 600, color: 'var(--muted)' }}>{entry.position}</div>
                  <div className="pc">
                    <div className="in-av">{entry.patient_name.split(' ').map((part) => part[0]).join('')}</div>
                    <div>
                      <div className="pn">{entry.patient_name}</div>
                    </div>
                  </div>
                  <div>
                    {entry.triage_record ? (
                      <span className={`tag ${entry.triage_record.category === 'critical' ? 'tc' : entry.triage_record.category === 'moderate' ? 'tm' : 'tmi'}`}>
                        {entry.triage_record.category}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Not triaged</span>
                    )}
                  </div>
                  <div>{entry.is_elderly && <span className="tag te">Elderly</span>}</div>
                  <div>
                    <span className={`tag ${entry.status === 'waiting' ? 'ta' : entry.status === 'called' ? 'tr' : 'tg'}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div>
                    <button
                      style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '6px 12px', font: "12px 'Inter',sans-serif", cursor: 'pointer' }}
                      onClick={() => markSeen(entry.id)}
                    >
                      Mark seen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
