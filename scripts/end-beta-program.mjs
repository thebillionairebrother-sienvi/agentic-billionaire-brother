#!/usr/bin/env node
/**
 * End the beta program: move comped Brother/Team users back to the free plan
 * and give the admin accounts admin mode.
 *
 *   node scripts/end-beta-program.mjs                 # dry run (default, read-only)
 *   node scripts/end-beta-program.mjs --apply         # perform the changes
 *   node scripts/end-beta-program.mjs --env .env.staging
 *
 * Never downgraded:
 *   - admin accounts (ADMIN_EMAILS below or profiles.role = 'admin')
 *   - anyone with a Stripe subscription that is active / trialing / past_due
 *     (e.g. someone who started the BFCM trial while still on a comp)
 * Idempotent: re-running only touches users still on a comped paid tier.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Keep in sync with ADMIN_EMAILS in src/lib/admin.ts
const ADMIN_EMAILS = [
    'teamsienvi@gmail.com',
    'spenceralmodiel@gmail.com',
    'scott@sienvi.com',
    'yourbro@thebillionairebrother.com',
    'info@sienvi.com',
];
const STRIPE_MANAGED = new Set(['active', 'trialing', 'past_due']);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.local';

const env = Object.fromEntries(
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: users, error } = await supabase
    .from('users')
    .select('id, email, tier, subscription_status')
    .in('tier', ['brother', 'team']);
if (error) throw error;

const { data: adminProfiles } = await supabase.from('profiles').select('id, email, role').eq('role', 'admin');
const adminIds = new Set((adminProfiles ?? []).map((p) => p.id));

const { data: liveSubs } = await supabase
    .from('subscriptions')
    .select('user_id, status, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null)
    .in('status', ['active', 'trialing', 'past_due']);
const stripeUserIds = new Set((liveSubs ?? []).map((s) => s.user_id));

const isAdmin = (u) => ADMIN_EMAILS.includes((u.email || '').toLowerCase()) || adminIds.has(u.id);
const mask = (email) => (email || '').replace(/^(.{2}).*(@.*)$/, '$1***$2');

const keepAdmin = users.filter(isAdmin);
const keepStripe = users.filter((u) => !isAdmin(u) && (stripeUserIds.has(u.id) || STRIPE_MANAGED.has(u.subscription_status)));
const downgrade = users.filter((u) => !isAdmin(u) && !keepStripe.includes(u));

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (no changes)'} · env: ${envPath}`);
console.log(`Paid-tier users found: ${users.length}`);
console.log(`  keep (admin mode): ${keepAdmin.length}  ${keepAdmin.map((u) => mask(u.email)).join(', ')}`);
console.log(`  keep (Stripe subscription): ${keepStripe.length}  ${keepStripe.map((u) => mask(u.email)).join(', ')}`);
console.log(`  downgrade to free: ${downgrade.length}`);
for (const u of downgrade) console.log(`    - ${mask(u.email)} (${u.tier})`);

// Admin accounts not yet flagged in profiles
const { data: adminUsers } = await supabase.from('users').select('id, email, tier').in('email', ADMIN_EMAILS);
const needRole = (adminUsers ?? []).filter((u) => !adminIds.has(u.id));
console.log(`Admin role to grant: ${needRole.map((u) => mask(u.email)).join(', ') || 'none'}`);

if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to make these changes.');
    process.exit(0);
}

for (const u of downgrade) {
    const { error: e } = await supabase.from('users')
        .update({ tier: 'free', subscription_plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', u.id)
        .in('tier', ['brother', 'team']);
    if (e) console.error(`  ! failed for ${mask(u.email)}:`, e.message);
}
for (const u of needRole) {
    const { error: e } = await supabase.from('profiles').upsert({ id: u.id, email: u.email, role: 'admin' }, { onConflict: 'id' });
    if (e) console.error(`  ! admin role failed for ${mask(u.email)}:`, e.message);
}
for (const u of adminUsers ?? []) {
    if (u.tier !== 'team') await supabase.from('users').update({ tier: 'team' }).eq('id', u.id);
}
console.log('\nApplied.');
