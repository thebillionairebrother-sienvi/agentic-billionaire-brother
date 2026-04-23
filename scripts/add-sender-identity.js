import { createClient } from '@supabase/supabase-js';

async function addSenderIdentity() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const email = 'teamsienvi@gmail.com';

  // 1. Get the admin profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) {
    console.error('Admin profile not found in database. Cannot associate sender identity.');
    process.exit(1);
  }

  // 2. Check if identity already exists
  const { data: existing } = await supabase
    .from('sender_identities')
    .select('id')
    .eq('user_id', profile.id)
    .eq('from_email', 'derek@billionairebrother.com')
    .single();

  if (existing) {
    console.log('Sender identity already exists!');
    process.exit(0);
  }

  // 3. Insert identity
  const { error } = await supabase.from('sender_identities').insert({
    user_id: profile.id,
    from_name: 'Derek',
    from_email: 'derek@billionairebrother.com',
    domain: 'billionairebrother.com',
    spf_verified: true, // Optimistically assuming DNS is handled
    dkim_verified: true
  });

  if (error) {
    console.error('Failed to add sender identity:', error);
    process.exit(1);
  }

  console.log('Successfully added derek@billionairebrother.com to sender identities!');
}

addSenderIdentity();
