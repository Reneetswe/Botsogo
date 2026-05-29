import { redirect } from 'next/navigation';
import MedicinesClient from './MedicinesClient';
import { createClient } from '@/lib/supabase/server';

export default async function MedicinesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/patient/login');
  }

  return <MedicinesClient />;
}
