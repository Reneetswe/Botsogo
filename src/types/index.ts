export interface PatientProfile {
  id: string;
  fname: string;
  lname: string;
  omang: string;
  phone: string;
  preferred_clinic_id: string;
  created_at: string;
}

export interface Clinic {
  id: string;
  name: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export type StaffRole = 'nurse' | 'doctor';

export interface StaffMember {
  id: string;
  staff_code: string;
  pin_hash: string;
  name: string;
  post: string;
  role: StaffRole;
  clinic_id: string;
  late: boolean;
}

export interface StaffNavItem {
  id: StaffView;
  icon: string;
  label: string;
}

export type StaffView = 'overview' | 'queue' | 'triage' | 'patients' | 'consults' | 'clockin';

export interface ClinicStatus {
  name: string;
  distance: string;
  count: number;
  loadClass: string;
  numberClass: string;
  fillWidth: string;
  posts: Array<{ label: string; ok: boolean }>;
}

export type AlertTone = 'r' | 'a' | 'g';
