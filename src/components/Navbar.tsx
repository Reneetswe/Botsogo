import NavbarClient from './NavbarClient';
import { createClient } from '@/lib/supabase/server';
import type { PatientProfile } from '@/types';

interface NavbarProps {
  firstName?: string;
}

export default async function Navbar({ firstName }: NavbarProps) {
  if (firstName) {
    return <NavbarClient firstName={firstName} />;
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return <NavbarClient />;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,fname,lname,omang,phone,preferred_clinic_id,created_at')
    .eq('id', userData.user.id)
    .maybeSingle<PatientProfile>();

  return <NavbarClient firstName={profile?.fname} />;
}