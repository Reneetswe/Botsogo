import type { StaffMember, StaffNavItem } from '@/types';

export const ROLE_NAV: Record<StaffMember['role'], StaffNavItem[]> = {
  nurse: [
    { id: 'overview', icon: 'ti-layout-dashboard', label: 'Overview' },
    { id: 'queue', icon: 'ti-list-numbers', label: 'Patient Queue' },
    { id: 'triage', icon: 'ti-stethoscope', label: 'Triage' },
    { id: 'clockin', icon: 'ti-clock-check', label: 'Clock-In' },
  ],
  doctor: [
    { id: 'overview', icon: 'ti-layout-dashboard', label: 'Overview' },
    { id: 'patients', icon: 'ti-users', label: 'My Patients' },
    { id: 'consults', icon: 'ti-notes-medical', label: 'Consultations' },
    { id: 'clockin', icon: 'ti-clock-check', label: 'Clock-In' },
  ],
};

export const staffViewTitles = {
  overview: 'Overview',
  queue: 'Patient Queue',
  triage: 'Triage',
  patients: 'My Patients',
  consults: 'Consultations',
  clockin: 'Clock-In',
};
