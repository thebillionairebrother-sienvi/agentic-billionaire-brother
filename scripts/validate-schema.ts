/**
 * DB Schema Validation Script
 * Checks that all required metering/governance tables, columns, and RPCs exist in Supabase.
 *
 * Usage: npx tsx scripts/validate-schema.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually (no dotenv dependency needed)
try {
    const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
    for (const line of envFile.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
} catch {
    console.warn('⚠️  Could not read .env.local — using existing environment variables');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Required tables ──
const REQUIRED_TABLES = [
    'users',
    'subscriptions',
    'feature_flags',
    'kill_switches',
    'workflow_definitions',
    'workflow_runs',
    'request_logs',
    'usage_daily_user',
    'usage_weekly_user',
    'usage_monthly_workspace',
    'revenue_events',
    'cost_alerts',
];

// ── Required columns on users table ──
const REQUIRED_USER_COLUMNS = ['tier', 'charter_member'];

// ── Required RPC functions ──
const REQUIRED_RPCS = [
    'increment_daily_usage',
    'increment_monthly_usage',
    'increment_weekly_regen',
];

async function checkTable(table: string): Promise<boolean> {
    try {
        const { error } = await supabase.from(table).select('*').limit(0);
        return !error;
    } catch {
        return false;
    }
}

async function checkUserColumn(column: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('users').select(column).limit(0);
        return !error;
    } catch {
        return false;
    }
}

async function checkRpc(rpcName: string): Promise<boolean> {
    try {
        // Call with dummy params to check existence (will fail on constraints but not on "function not found")
        const { error } = await supabase.rpc(rpcName, {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            ...(rpcName === 'increment_daily_usage' ? {
                p_prompts: 0,
                p_input_tokens: 0,
                p_output_tokens: 0,
                p_cost: 0,
                p_is_regen: false,
                p_is_workflow: false,
            } : rpcName === 'increment_monthly_usage' ? {
                p_month_start: '2025-01-01',
                p_tokens: 0,
                p_prompts: 0,
                p_cost: 0,
                p_is_regen: false,
            } : {
                p_week_start: '2025-01-06',
            }),
        });

        // If the error is about the function not existing, it's missing
        if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
            return false;
        }
        // Any other error (constraint violation, etc.) means the function exists
        return true;
    } catch {
        return false;
    }
}

async function main() {
    console.log('🔍 Validating Billionaire Brother DB Schema...\n');
    console.log('─'.repeat(50));

    let allPassed = true;

    // Check tables
    console.log('\n📋 TABLES\n');
    for (const table of REQUIRED_TABLES) {
        const exists = await checkTable(table);
        const icon = exists ? '✅' : '❌';
        console.log(`  ${icon}  ${table}`);
        if (!exists) allPassed = false;
    }

    // Check user columns
    console.log('\n👤 USER COLUMNS\n');
    for (const col of REQUIRED_USER_COLUMNS) {
        const exists = await checkUserColumn(col);
        const icon = exists ? '✅' : '❌';
        console.log(`  ${icon}  users.${col}`);
        if (!exists) allPassed = false;
    }

    // Check RPCs
    console.log('\n⚡ RPC FUNCTIONS\n');
    for (const rpc of REQUIRED_RPCS) {
        const exists = await checkRpc(rpc);
        const icon = exists ? '✅' : '❌';
        console.log(`  ${icon}  ${rpc}()`);
        if (!exists) allPassed = false;
    }

    console.log('\n' + '─'.repeat(50));

    if (allPassed) {
        console.log('\n🎉 All schema checks passed! Your DB is fully provisioned.\n');
    } else {
        console.log('\n⚠️  Some items are missing. Run the migration SQL below to fix:\n');
        console.log('   See: supabase/migrations/ for the full migration file.');
        console.log('   Or copy the SQL from the metering_schema.md KI artifact.\n');
    }

    process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
