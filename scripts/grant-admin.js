import { createClient } from '@supabase/supabase-js';

async function grantAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const email = 'teamsienvi@gmail.com';

  console.log(`Granting admin access to ${email}...`);

  // First, check if the profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (!profile) {
    // If no profile, they might not have logged in yet. 
    // We can upsert if we had the ID, but we need the auth.users ID.
    // Let's lookup their auth.user ID
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Failed to list users:', authError.message);
      process.exit(1);
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log(`User ${email} not found in auth.users. They need to sign up first, or we can just append it to the SQL migration for when they do.`);
      // We will just let the SQL migration or future login handle it.
      process.exit(0);
    }

    // Upsert profile
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      role: 'admin'
    });

    if (upsertError) {
      console.error('Failed to upsert profile:', upsertError.message);
      process.exit(1);
    }
    console.log(`Successfully created profile and granted admin to ${email}`);
  } else {
    // Update existing
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', email);

    if (updateError) {
      console.error('Failed to update profile:', updateError.message);
      process.exit(1);
    }
    console.log(`Successfully updated existing profile to admin for ${email}`);
  }
}

grantAdmin();
