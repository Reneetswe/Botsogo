'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StaffMember } from '@/types';

interface TriageViewProps {
  staff: StaffMember;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function TriageView({ staff }: TriageViewProps) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [triage, setTriage] = useState<'info' | 'critical' | 'moderate' | 'mild' | 'empty'>('info');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isElderly, setIsElderly] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState<Array<{ id: string; position: number; patient_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [triageError, setTriageError] = useState('');
  const [triageSuccess, setTriageSuccess] = useState('');

  const result = { info: ['tr-i', 'ici', 'ti-info-circle', 'Select symptoms to run triage', 'Select presenting symptoms above, then tap Run triage.', 'var(--teal-dk)'], empty: ['tr-i', 'ici', 'ti-info-circle', 'Select symptoms first', 'Tap at least one symptom above.', 'var(--teal-dk)'], critical: ['tr-c', 'icc', 'ti-urgent', 'Critical — see doctor immediately', 'Severe symptom combination. Elderly auto-priority override applied.', 'var(--red)'], moderate: ['tr-m', 'icm', 'ti-alert-circle', 'Moderate — schedule with doctor', 'Non-urgent. Added to doctor queue.', 'var(--amber)'], mild: ['tr-ml', 'icml', 'ti-check', 'Mild — nurse can handle', 'Routed to nurse queue. Estimated wait 10 minutes.', 'var(--green)'] }[triage];

  const runTriage = () => {
    const selected = symptoms.map((symptom) => symptom.toLowerCase());
    if (selected.includes('chest pain') || selected.includes('shortness of breath')) setTriage('critical');
    else if (selected.includes('fever') || selected.includes('headache')) setTriage('moderate');
    else if (selected.length > 0) setTriage('mild');
    else setTriage('empty');
  };

  const resetTriage = () => {
    setSymptoms([]);
    setTriage('info');
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms((current) => current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]);
  };

  const fetchWaitingPatients = useCallback(async () => {
    const supabase = createClient();
    const today = todayIsoDate();

    const { data: queueRows } = await supabase
      .from('queues')
      .select('id')
      .eq('date', today)
      .eq('clinic_id', staff.clinic_id);

    const queueIds = ((queueRows ?? []) as Array<{ id: string }>).map((q) => q.id);

    if (!queueIds.length) {
      setWaitingPatients([]);
      setLoading(false);
      return;
    }

    const { data: entryRows } = await supabase
      .from('queue_entries')
      .select('id,position,patient_name')
      .in('queue_id', queueIds)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    const entries = (entryRows ?? []) as Array<{ id: string; position: number; patient_name: string }>;

    const { data: triageRows } = await supabase
      .from('triage_records')
      .select('queue_entry_id')
      .in('queue_entry_id', entries.map((e) => e.id));

    const triagedEntryIds = new Set((triageRows ?? []).map((t) => t.queue_entry_id));
    const untriaged = entries.filter((e) => !triagedEntryIds.has(e.id));

    setWaitingPatients(untriaged);
    setLoading(false);
  }, [staff.clinic_id]);

  const confirmAndRoute = async () => {
    if (!selectedEntryId) {
      setTriageError('Please select a patient first.');
      return;
    }
    if (triage === 'info' || triage === 'empty') {
      setTriageError('Please run triage first.');
      return;
    }

    setConfirming(true);
    setTriageError('');
    setTriageSuccess('');

    const supabase = createClient();

    const { error: triageInsertError } = await supabase
      .from('triage_records')
      .insert({
        queue_entry_id: selectedEntryId,
        symptoms,
        category: triage,
        triaged_by: staff.id,
      });

    if (triageInsertError) {
      setTriageError('Failed to save triage: ' + triageInsertError.message);
      setConfirming(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('queue_entries')
      .update({
        is_elderly: isElderly,
        priority: triage === 'critical' || isElderly,
      })
      .eq('id', selectedEntryId);

    if (updateError) {
      setTriageError('Failed to update patient: ' + updateError.message);
      setConfirming(false);
      return;
    }

    const destination = triage === 'mild' ? 'nurse queue' : 'doctor queue';
    setTriageSuccess(`Patient successfully routed to ${destination}`);

    setSelectedEntryId(null);
    setSymptoms([]);
    setTriage('info');
    setIsElderly(false);
    setConfirming(false);

    void fetchWaitingPatients();
  };

  useEffect(() => {
    void fetchWaitingPatients();
  }, [fetchWaitingPatients]);

  return (
    <div className="sv-v active" id="sv-triage">
      <div className="tbl" style={{ marginBottom: '1rem' }}>
        <div className="tbl-hd">
          <span className="tbl-ht">Triage Current Patient</span>
        </div>
        <div style={{ padding: '1.125rem' }}>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading patients...</div>
          ) : waitingPatients.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No patients awaiting triage right now</div>
          ) : (
            <>
              <select
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', marginBottom: '1rem', font: "13px 'Inter',sans-serif" }}
                value={selectedEntryId ?? ''}
                onChange={(e) => setSelectedEntryId(e.target.value || null)}
              >
                <option value="">Select a patient to triage</option>
                {waitingPatients.map((entry) => (
                  <option key={entry.id} value={entry.id}>Q-{entry.position} — {entry.patient_name}</option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', fontSize: 13 }}>
                <input type="checkbox" checked={isElderly} onChange={(e) => setIsElderly(e.target.checked)} />
                Mark as elderly — auto priority
              </label>
            </>
          )}
          {successMessage && (
            <div className="alert al-g" style={{ marginBottom: '1rem' }}>
              <i className="ti ti-check"></i>
              <div>
                <div className="al-t">Success</div>
                <div className="al-b">{successMessage}</div>
              </div>
            </div>
          )}
          {triageError && (
            <div className="auth-err" style={{ display: 'block', marginTop: '1rem' }}>
              {triageError}
            </div>
          )}
          {triageSuccess && (
            <div className="alert al-g" style={{ marginTop: '1rem' }}>
              <i className="ti ti-check"></i>
              <div>
                <div className="al-t">{triageSuccess}</div>
              </div>
            </div>
          )}
          <div className="sect-label">Presenting symptoms</div>
          <div className="chip-grid">
            {['Chest pain', 'Headache', 'Shortness of breath', 'Fever', 'Cough', 'Diarrhoea', 'Joint pain', 'Rash'].map((symptom) => (
              <button
                className={`chip ${symptoms.includes(symptom) ? 'on' : ''}`}
                key={symptom}
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <button
              style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r)', padding: '9px 16px', font: "500 13px 'Inter',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={runTriage}
            >
              <i className="ti ti-cpu"></i>Run triage
            </button>
            <button
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 'var(--r)', padding: '9px 16px', font: "13px 'Inter',sans-serif", cursor: 'pointer' }}
              onClick={resetTriage}
            >
              Reset
            </button>
          </div>
          <div className={`tri-res ${result[0]}`} id="tri-result">
            <div className={`tri-ic ${result[1]}`}>
              <i className={`ti ${result[2]}`}></i>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: result[5] }}>{result[3]}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{result[4]}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {(triage === 'critical' || triage === 'moderate' || triage === 'mild') && (
          <button
            className="auth-btn"
            style={{ marginTop: '1rem' }}
            onClick={confirmAndRoute}
            disabled={confirming || !selectedEntryId}
          >
            {confirming
              ? 'Routing patient...'
              : `Confirm — route to ${triage === 'mild' ? 'nurse' : 'doctor'} queue`}
          </button>
        )}
        <div className="dg-c">
          <i className="ti ti-stethoscope" style={{ fontSize: 20, color: 'var(--red)' }}></i>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginTop: 8 }}>Doctor queue</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>3 critical · 11 moderate</div>
        </div>
        <div className="dg-c">
          <i className="ti ti-bandage" style={{ fontSize: 20, color: 'var(--green)' }}></i>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginTop: 8 }}>Nurse queue</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>18 mild cases</div>
        </div>
      </div>
    </div>
  );
}
