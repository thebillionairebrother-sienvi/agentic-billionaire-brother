import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const email = 'scott@siemvi.com';

async function main() {
  console.log(`Searching for user ${email}...`);

  // 1. Get user from auth.users
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Failed to list users:', authError.message);
    process.exit(1);
  }

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (!authUser) {
    console.log(`User ${email} does not exist in auth.users yet. Doing DB upsert preemptively in users table just in case, but user must signup first to use auth.`);
  } else {
    console.log(`Found auth user ID: ${authUser.id}`);
  }

  if (authUser) {
    // 2. Upsert or update public.users
    console.log(`Updating public.users for ${email}...`);
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .upsert({
        id: authUser.id,
        email: email,
        display_name: authUser.user_metadata?.display_name || 'Scott Siemvi',
        tier: 'team'
      })
      .select();

    if (userError) {
      console.error('Failed to update public.users:', userError.message);
    } else {
      console.log('Successfully updated public.users:', userRow);
    }

    // 3. Upsert or update subscription
    console.log(`Updating subscriptions for ${email}...`);
    const { data: subRow, error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: authUser.id,
        tier: 'team',
        status: 'active',
        charter_pricing: true,
        current_period_start: new Date().toISOString()
      })
      .select();

    if (subError) {
      console.error('Failed to update subscription:', subError.message);
    } else {
      console.log('Successfully updated subscription:', subRow);
    }
  }

  console.log('Done!');
}

main();
