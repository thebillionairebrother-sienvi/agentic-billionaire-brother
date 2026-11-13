import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/admin';

export async function requireAdmin() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!isAdminUser(user.email, profile?.role)) {
    redirect('/dashboard'); // Non-admins should not see the admin area
  }

  return { user, profile };
}

export async function checkIsAdmin() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return isAdminUser(user.email, profile?.role);
}
