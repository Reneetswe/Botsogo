'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type MenuState = 
  'main' | 'clinic_queue_select' | 'clinic_queue_result' | 
  'clinic_load' | 'medicine_search_prompt' | 'medicine_search_results' | 
  'omang_input_join' | 'omang_confirm_join' | 'join_success' | 
  'join_already_in_queue' | 'omang_input_status' | 'status_result' | 
  'status_not_in_queue' | 'exit';

interface Clinic {
  id: string;
  name: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
}

interface QueueEntry {
  id: string;
  queue_id: string;
  patient_id: string;
  position: number;
  status: string;
  joined_at: string;
}

interface ClockIn {
  id: string;
  staff_id: string;
  clinic_id: string;
  shift_date: string;
}

interface Staff {
  id: string;
  clinic_id: string;
  role: string;
}

interface Medicine {
  id: string;
  name: string;
  generic_name: string | null;
}

interface MedicineStock {
  id: string;
  clinic_id: string;
  medicine_id: string;
  level: string;
  updated_at: string;
}

interface Profile {
  id: string;
  fname: string;
  lname: string;
  omang: string;
}

interface ScreenData {
  clinics?: Clinic[];
  selectedClinic?: Clinic;
  queueCount?: number;
  doctorOnDuty?: boolean;
  medicineResults?: Array<{ medicine: Medicine; stocks: Array<{ clinic: Clinic; level: string }> }>;
  searchTerm?: string;
  enteredOmang?: string;
  foundProfile?: Profile;
  queuePosition?: number;
  queueClinic?: Clinic;
  estSlot?: string;
}

export default function USSDPage() {
  const [currentTime, setCurrentTime] = useState('');
  const [input, setInput] = useState('');
  const [screen, setScreen] = useState<MenuState>('main');
  const [display, setDisplay] = useState<string[]>([
    'Welcome to Botsogo.',
    'Ministry of Health, Botswana.',
    '',
    '1. Check clinic queue',
    '2. Check clinic load',
    '3. Medicine stock',
    '4. My queue status',
    '0. Exit',
  ]);
  const [loading, setLoading] = useState(false);
  const [screenData, setScreenData] = useState<ScreenData>({});

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    const value = input.trim();
    setInput('');
    
    if (loading) return;

    if (screen === 'main') {
      if (value === '1') {
        await handleClinicQueueSelect();
      } else if (value === '2') {
        await handleClinicLoad();
      } else if (value === '3') {
        setScreen('medicine_search_prompt');
        setDisplay([
          'Medicine stock search.',
          '',
          'Type a medicine name',
          'e.g. Metformin',
          '',
          '0. Back',
        ]);
      } else if (value === '4') {
        setScreen('omang_input_status');
        setDisplay([
          'Enter your Omang ID number',
          'to check your queue status:',
          '',
          '0. Back',
        ]);
      } else if (value === '0') {
        setScreen('exit');
        setDisplay([
          'Thank you for using Botsogo.',
          'Stay well, Botswana.',
          '',
          '[Session ended]',
        ]);
      }
    } else if (screen === 'clinic_queue_select') {
      const index = parseInt(value, 10) - 1;
      if (screenData.clinics && index >= 0 && index < screenData.clinics.length) {
        await handleClinicQueueResult(screenData.clinics[index]);
      } else if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'clinic_queue_result') {
      if (value === '1') {
        setScreen('omang_input_join');
        setDisplay([
          'To join the queue please',
          'enter your Omang ID number:',
          '',
          '0. Back',
        ]);
      } else if (value === '2') {
        await handleClinicQueueSelect();
      } else if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'omang_input_join') {
      if (value === '0') {
        if (screenData.selectedClinic) {
          await handleClinicQueueResult(screenData.selectedClinic);
        } else {
          resetToMain();
        }
      } else if (value) {
        await handleOmangLookupJoin(value);
      }
    } else if (screen === 'omang_confirm_join') {
      if (value === '1') {
        await handleJoinQueue();
      } else if (value === '2') {
        setScreen('omang_input_join');
        setDisplay([
          'To join the queue please',
          'enter your Omang ID number:',
          '',
          '0. Back',
        ]);
      } else if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'join_success') {
      if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'join_already_in_queue') {
      if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'clinic_load') {
      if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'medicine_search_prompt') {
      if (value === '0') {
        resetToMain();
      } else if (value) {
        await handleMedicineSearch(value);
      }
    } else if (screen === 'medicine_search_results') {
      if (value === '1') {
        setScreen('medicine_search_prompt');
        setDisplay([
          'Medicine stock search.',
          '',
          'Type a medicine name',
          'e.g. Metformin',
          '',
          '0. Back',
        ]);
      } else if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'omang_input_status') {
      if (value === '0') {
        resetToMain();
      } else if (value) {
        await handleOmangLookupStatus(value);
      }
    } else if (screen === 'status_result') {
      if (value === '0') {
        resetToMain();
      }
    } else if (screen === 'status_not_in_queue') {
      if (value === '1') {
        await handleClinicQueueSelect();
      } else if (value === '0') {
        resetToMain();
      }
    }
  };

  const resetToMain = () => {
    setScreen('main');
    setDisplay([
      'Welcome to Botsogo.',
      'Ministry of Health, Botswana.',
      '',
      '1. Check clinic queue',
      '2. Check clinic load',
      '3. Medicine stock',
      '4. My queue status',
      '0. Exit',
    ]);
    setScreenData({});
  };

  const handleCancel = () => {
    resetToMain();
  };

  const calculateEstSlot = (position: number): string => {
    const baseTime = new Date();
    baseTime.setMinutes(baseTime.getMinutes() + (position * 2.5));
    return baseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleOmangLookupJoin = async (omang: string) => {
    setLoading(true);
    setDisplay(['Looking up profile...']);
    
    try {
      const supabase = createClient();
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, fname, lname, omang')
        .eq('omang', omang.trim())
        .single();

      if (error || !profile) {
        setDisplay([
          'Omang not found.',
          'Please register at a clinic',
          'or at botsogo.co.bw first.',
          '',
          '0. Main menu',
        ]);
        setLoading(false);
        return;
      }

      setScreenData({ ...screenData, enteredOmang: omang, foundProfile: profile });
      setDisplay([
        `Welcome, ${profile.fname}.`,
        '',
        'Join queue at:',
        `${screenData.selectedClinic?.name}?`,
        '',
        '1. Yes, join queue',
        '2. No, go back',
        '0. Main menu',
      ]);
      setScreen('omang_confirm_join');
    } catch {
      setDisplay(['Error looking up profile.', '', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinQueue = async () => {
    setLoading(true);
    setDisplay(['Please wait...']);
    
    try {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const profile = screenData.foundProfile;
      const clinic = screenData.selectedClinic;

      if (!profile || !clinic) {
        setDisplay(['Error: Missing data.', '', '0. Main menu']);
        setLoading(false);
        return;
      }

      const { data: queues } = await supabase
        .from('queues')
        .select('id')
        .eq('clinic_id', clinic.id)
        .eq('date', today);

      let queueId: string | null = null;
      if (queues && queues.length > 0) {
        queueId = queues[0].id;
      } else {
        const { data: newQueue } = await supabase
          .from('queues')
          .insert({
            clinic_id: clinic.id,
            date: today,
            status: 'active',
          })
          .select('id')
          .single();
        queueId = newQueue?.id ?? null;
      }

      if (!queueId) {
        setDisplay(['Error creating queue.', '', '0. Main menu']);
        setLoading(false);
        return;
      }

      const { data: existingEntries } = await supabase
        .from('queue_entries')
        .select('id, position, queue_id')
        .eq('patient_id', profile.id)
        .in('status', ['waiting', 'called']);

      if (existingEntries && existingEntries.length > 0) {
        const { data: entryQueue } = await supabase
          .from('queues')
          .select('clinic_id')
          .eq('id', existingEntries[0].queue_id)
          .single();
        
        const { data: entryClinic } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', entryQueue?.clinic_id)
          .single();

        const position = existingEntries[0].position;
        const estSlot = calculateEstSlot(position);

        setDisplay([
          'You are already in a queue',
          `today at ${entryClinic?.name}.`,
          `Position: ${position}`,
          `Est. slot: ${estSlot}`,
          '',
          '0. Main menu',
        ]);
        setScreen('join_already_in_queue');
        setLoading(false);
        return;
      }

      const { count } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('queue_id', queueId);

      const position = (count ?? 0) + 1;
      const estSlot = calculateEstSlot(position);

      const { error: insertError } = await supabase
        .from('queue_entries')
        .insert({
          queue_id: queueId,
          patient_id: profile.id,
          patient_name: `${profile.fname} ${profile.lname}`,
          position: position,
          status: 'waiting',
        });

      if (insertError) {
        setDisplay(['Error joining queue.', '', '0. Main menu']);
        setLoading(false);
        return;
      }

      setDisplay([
        'Queue joined successfully!',
        '',
        `Clinic: ${clinic.name}`,
        `Your number: Q-${position}`,
        `Position: ${position} in queue`,
        `Est. slot: ~${estSlot}`,
        '',
        'You will be seen around',
        'this time. Please arrive',
        '15 minutes before.',
        '',
        '0. Main menu',
      ]);
      setScreen('join_success');
    } catch {
      setDisplay(['Error joining queue.', '', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  const handleOmangLookupStatus = async (omang: string) => {
    setLoading(true);
    setDisplay(['Looking up profile...']);
    
    try {
      const supabase = createClient();
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, fname, lname, omang')
        .eq('omang', omang.trim())
        .single();

      if (error || !profile) {
        setDisplay([
          'Omang not found.',
          'Please register first.',
          '',
          '0. Main menu',
        ]);
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      const { data: queues } = await supabase
        .from('queues')
        .select('id, clinic_id')
        .eq('date', today);

      const queueIds = (queues ?? []).map((q) => q.id);

      let activeEntry: QueueEntry | null = null;
      let clinic: Clinic | null = null;

      if (queueIds.length > 0) {
        const { data: entries } = await supabase
          .from('queue_entries')
          .select('id, queue_id, position, status, joined_at, patient_id')
          .eq('patient_id', profile.id)
          .in('queue_id', queueIds)
          .in('status', ['waiting', 'called'])
          .order('joined_at', { ascending: false });

        if (entries && entries.length > 0) {
          activeEntry = entries[0];
          
          if (queues) {
            const queue = queues.find(q => q.id === activeEntry?.queue_id);
            if (queue) {
              const { data: entryClinic } = await supabase
                .from('clinics')
                .select('id, name, location, lat, lng')
                .eq('id', queue.clinic_id)
                .single();
              
              clinic = entryClinic ?? null;
            }
          }
        }
      }

      if (activeEntry && clinic) {
        const { data: aheadEntries } = await supabase
          .from('queue_entries')
          .select('id')
          .eq('queue_id', activeEntry.queue_id)
          .eq('status', 'waiting')
          .lt('joined_at', activeEntry.joined_at);

        const ahead = (aheadEntries ?? []).length;
        const position = activeEntry.position;
        const estSlot = calculateEstSlot(position);

        setDisplay([
          `${profile.fname}'s queue status:`,
          '',
          `Clinic: ${clinic.name}`,
          `Number: Q-${position}`,
          `Position: ${ahead + 1} of ${position + ahead}`,
          `Est. slot: ~${estSlot}`,
          '',
          '0. Main menu',
        ]);
        setScreen('status_result');
      } else {
        setDisplay([
          `${profile.fname}, you are not`,
          'currently in any queue today.',
          '',
          '1. Join a queue',
          '0. Main menu',
        ]);
        setScreen('status_not_in_queue');
      }
    } catch {
      setDisplay(['Error checking status.', '', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  const handleClinicQueueSelect = async () => {
    setLoading(true);
    setDisplay(['Fetching clinics...']);
    
    try {
      const supabase = createClient();
      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name, location, lat, lng')
        .order('name', { ascending: true });

      if (clinics && clinics.length > 0) {
        setScreenData({ clinics });
        const lines = ['Select a clinic:', ''];
        clinics.slice(0, 9).forEach((clinic, index) => {
          lines.push(`${index + 1}. ${clinic.name}`);
        });
        lines.push('', '0. Main menu');
        setDisplay(lines);
        setScreen('clinic_queue_select');
      } else {
        setDisplay(['No clinics found.', '', '0. Main menu']);
      }
    } catch {
      setDisplay(['Error loading clinics.', '', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  const handleClinicQueueResult = async (clinic: Clinic) => {
    setLoading(true);
    setDisplay(['Fetching queue data...']);
    
    try {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);

      const { data: queues } = await supabase
        .from('queues')
        .select('id')
        .eq('clinic_id', clinic.id)
        .eq('date', today);

      const queueIds = (queues ?? []).map((q) => q.id);

      let queueCount = 0;
      if (queueIds.length > 0) {
        const { data: entries } = await supabase
          .from('queue_entries')
          .select('status')
          .in('queue_id', queueIds);
        
        queueCount = (entries ?? []).filter((e) => e.status === 'waiting').length;
      }

      const { data: clockIns } = await supabase
        .from('clock_ins')
        .select('staff_id')
        .eq('clinic_id', clinic.id)
        .eq('shift_date', today);

      const staffIds = (clockIns ?? []).map((c) => c.staff_id);
      let doctorOnDuty = false;
      
      if (staffIds.length > 0) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('role')
          .in('id', staffIds);
        
        doctorOnDuty = (staffData ?? []).some((s) => s.role === 'doctor');
      }

      const estWait = Math.round(queueCount * 2.5);

      setScreenData({ selectedClinic: clinic, queueCount, doctorOnDuty });
      setDisplay([
        clinic.name,
        '',
        `Queue: ${queueCount} patients`,
        `Est. wait: ${estWait} min`,
        `Doctor: ${doctorOnDuty ? 'ON DUTY' : 'NOT ON DUTY'}`,
        '',
        '1. Join this queue',
        '2. Check another clinic',
        '0. Main menu',
      ]);
      setScreen('clinic_queue_result');
    } catch {
      setDisplay(['Error loading queue data.', '', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  const handleClinicLoad = async () => {
    setLoading(true);
    setDisplay(['Fetching clinic load...']);
    
    try {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);

      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name, location, lat, lng')
        .order('name', { ascending: true });

      const { data: queues } = await supabase
        .from('queues')
        .select('id, clinic_id')
        .eq('date', today);

      const queueIds = (queues ?? []).map((q) => q.id);
      const queueClinicMap = new Map((queues ?? []).map((q) => [q.clinic_id, q.id]));

      const clinicLoads: Array<{ clinic: Clinic; load: number }> = [];

      if (queueIds.length > 0) {
        const { data: entries } = await supabase
          .from('queue_entries')
          .select('queue_id, status')
          .in('queue_id', queueIds);

        const entriesByQueue = new Map<string, number>();
        (entries ?? []).forEach((e) => {
          if (e.status === 'waiting') {
            entriesByQueue.set(e.queue_id, (entriesByQueue.get(e.queue_id) || 0) + 1);
          }
        });

        (clinics ?? []).forEach((clinic) => {
          const queueId = queueClinicMap.get(clinic.id);
          const load = queueId ? (entriesByQueue.get(queueId) || 0) : 0;
          clinicLoads.push({ clinic, load });
        });
      } else {
        (clinics ?? []).forEach((clinic) => {
          clinicLoads.push({ clinic, load: 0 });
        });
      }

      const getLoadLevel = (load: number): string => {
        if (load <= 30) return 'LOW';
        if (load <= 65) return 'MED';
        return 'HIGH';
      };

      const lines = ['Clinic load — right now:', ''];
      clinicLoads.slice(0, 9).forEach(({ clinic, load }, index) => {
        lines.push(`${index + 1}. ${clinic.name} — ${getLoadLevel(load)} (${load})`);
      });
      lines.push('', '0. Back');
      setDisplay(lines);
      setScreen('clinic_load');
    } catch {
      setDisplay(['Error loading clinic load.', '', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  const handleMedicineSearch = async (term: string) => {
    setLoading(true);
    setDisplay(['Searching medicines...']);
    
    try {
      const supabase = createClient();

      const { data: medicines } = await supabase
        .from('medicines')
        .select('id, name, generic_name')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(5);

      if (!medicines || medicines.length === 0) {
        setDisplay([
          'Not found. Try:',
          'Metformin, Paracetamol',
          'Amoxicillin',
          '',
          '1. Try again',
          '0. Main menu',
        ]);
        setScreen('medicine_search_results');
        setLoading(false);
        return;
      }

      const medicineIds = medicines.map((m) => m.id);

      const { data: stockRows } = await supabase
        .from('medicine_stock')
        .select('medicine_id, clinic_id, level, updated_at')
        .in('medicine_id', medicineIds);

      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name');

      const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));

      const results = medicines.map((medicine) => {
        const stocks = (stockRows ?? [])
          .filter((s) => s.medicine_id === medicine.id)
          .map((s) => {
            const clinic = clinicMap.get(s.clinic_id);
            return { clinic, level: s.level };
          })
          .filter((s) => s.clinic !== undefined);

        return { medicine, stocks };
      });

      const lines: string[] = [];
      results.slice(0, 3).forEach(({ medicine, stocks }) => {
        lines.push(`${medicine.name}:`, '');
        stocks.slice(0, 5).forEach((s) => {
          const levelText = s.level === 'in_stock' ? 'IN STOCK' : s.level === 'low' ? 'LOW' : 'OUT';
          lines.push(`${s.clinic?.name} — ${levelText}`);
        });
      });
      lines.push('', '1. Search another', '0. Main menu');
      setDisplay(lines);
      setScreen('medicine_search_results');
    } catch {
      setDisplay(['Error searching medicines.', '', '1. Try again', '0. Main menu']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '2rem' }}>
      <Link className="auth-back" href="/">
        <i className="ti ti-arrow-left"></i> Back to home
      </Link>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem' }}>USSD Access — *384#</h1>
          <p style={{ fontSize: 18, color: 'var(--muted)', marginBottom: '2rem' }}>No smartphone or data needed. Works on any basic phone in Botswana.</p>
          
          <ul style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--navy)' }}>
            <li>Dial *384# on any Botswana number</li>
            <li>Works on Mascom, Orange, and BTC</li>
            <li>No internet connection required</li>
            <li>Available 24 hours a day</li>
            <li>Free to use — standard USSD rates apply</li>
          </ul>
          
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--teal-pale)', borderRadius: 'var(--r)', fontSize: 14, color: 'var(--teal)' }}>
            <strong>Note:</strong> This simulator shows live clinic and medicine data. Try it below.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 280,
            background: '#1a1a1a',
            borderRadius: 32,
            padding: 12,
            margin: '0 auto',
            flexShrink: 0,
          }}>
            {/* Screen */}
            <div style={{
              background: '#000',
              borderRadius: 22,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 520,
            }}>
              {/* Status bar */}
              <div style={{
                background: '#111',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#888',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                <span>BTC · MASCOM</span>
                <span>{currentTime}</span>
              </div>

              {/* USSD body */}
              <div style={{
                flex: 1,
                background: '#0d0d0d',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Header */}
                <div style={{
                  background: '#1a3a2a',
                  border: '1px solid #2a5a3a',
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 12,
                  flexShrink: 0,
                }}>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#4caf88', 
                    fontFamily: 'monospace',
                    fontWeight: 500,
                  }}>
                    Botsogo · *384#
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: '#3a7a58', 
                    fontFamily: 'monospace',
                    marginTop: 2,
                  }}>
                    Ministry of Health, Botswana
                  </div>
                </div>

                {/* Display text - scrollable */}
                <div style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: '#e0e0e0',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  marginBottom: 12,
                }}>
                  {display.map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}
                  {loading && <div style={{ color: '#ff0' }}>Loading...</div>}
                </div>

                {/* Input row */}
                <div style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 8,
                  flexShrink: 0,
                }}>
                  <input
                    type="text"
                    style={{
                      flex: 1,
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      color: '#e0e0e0',
                      outline: 'none',
                    }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading}
                    placeholder="Enter option..."
                  />
                  <button
                    style={{
                      background: '#1a3a2a',
                      border: '1px solid #2a5a3a',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#4caf88',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                    onClick={handleSend}
                    disabled={loading}
                  >
                    Send
                  </button>
                </div>

                {/* Cancel button - full width below input row */}
                <button
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: '1px solid #2a2a2a',
                    borderRadius: 6,
                    padding: '7px',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#666',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#e05050'
                    e.currentTarget.style.borderColor = '#e05050'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#666'
                    e.currentTarget.style.borderColor = '#2a2a2a'
                  }}
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel / End session
                </button>
              </div>
            </div>

            {/* Home button */}
            <div style={{
              width: 48,
              height: 48,
              background: '#222',
              borderRadius: '50%',
              margin: '10px auto 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
              onClick={handleCancel}
            >
              <div style={{
                width: 14,
                height: 14,
                background: '#444',
                borderRadius: '50%',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
