'use client';

import type { StaffMember } from '@/types';

interface ClockInViewProps {
  staff: StaffMember;
  time: string;
  clockedIn: boolean;
  clockedInAt: string | null;
  clockingIn: boolean;
  clockInError: string;
  onClockIn: () => Promise<void>;
}

function ShiftRecord({ done, time }: { done: boolean; time: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r2)', padding: '.875rem 1rem' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Your shift record — today</div>
      <div className="sl-r"><span>Morning shift (07:30)</span><span style={{ color: 'var(--green)' }}>Clocked in 07:34</span></div>
      <div className="sl-r"><span>Afternoon shift (14:00)</span><span style={{ color: done ? 'var(--green)' : 'var(--red)' }}>{done ? `Clocked in ${time}` : 'Not yet clocked in'}</span></div>
    </div>
  );
}

export default function ClockInView({ staff, time, clockedIn, clockedInAt, clockingIn, clockInError, onClockIn }: ClockInViewProps) {
  const clockedInTime = clockedInAt ? new Date(clockedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : time;
  return (
    <div className="sv-v active" id="sv-clockin">
      <div className="tbl" style={{ maxWidth: 500 }}>
        <div className="tbl-hd">
          <span className="tbl-ht">Clock-In Shift Record</span>
        </div>
        {clockInError && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{clockInError}</div>}
        {!clockedIn ? (
          <div style={{ padding: '1.25rem' }} id="sd-ci-pre">
            <div className={`alert ${staff.late ? 'al-a' : 'al-g'}`} id="sd-ci-alert" style={{ marginBottom: '1rem' }}>
              <i className={`ti ${staff.late ? 'ti-clock' : 'ti-check'}`}></i>
              <div>
                <div className="al-t" id="sd-ci-msg">{staff.late ? '14:00 shift — 18 minutes past shift start' : '14:00 shift — you are on time'}</div>
                <div className="al-b">{staff.late ? 'Your post is showing as unmanned to patients. Please clock in now.' : 'Tap below to record your clock-in for this shift.'}</div>
              </div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--r2)', padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Current time</div>
              <div style={{ fontSize: 40, fontWeight: 600, color: 'var(--navy)', letterSpacing: -1 }} id="sd-live-clk">{time}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, marginBottom: '1.25rem' }}>Gaborone West Clinic</div>
              <button
                style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r2)', padding: '11px 24px', font: "600 14px 'Inter',sans-serif", cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                onClick={onClockIn}
                disabled={clockingIn}
              >
                <i className="ti ti-clock-check" style={{ fontSize: 18 }}></i>{clockingIn ? 'Clocking in...' : 'Clock in now'}
              </button>
            </div>
            <ShiftRecord done={false} time={time} />
          </div>
        ) : (
          <div style={{ padding: '1.25rem' }} id="sd-ci-done">
            <div className="ci-ok" style={{ marginBottom: '1rem' }}>
              <div className="ci-chk"><i className="ti ti-check"></i></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--green)', marginBottom: 2 }}>You are clocked in</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Shift started at {clockedInTime}</div>
              </div>
            </div>
            <ShiftRecord done={true} time={clockedInTime} />
          </div>
        )}
      </div>
    </div>
  );
}
