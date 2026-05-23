import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { createClient } from '@/lib/supabase/server';
import type { PatientProfile } from '@/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,fname,lname,omang,phone,preferred_clinic_id,created_at')
    .eq('id', userData.user.id)
    .single<PatientProfile>();

  if (error || !profile) {
    redirect('/login');
  }

  return <DashboardClient profile={profile} />;
}