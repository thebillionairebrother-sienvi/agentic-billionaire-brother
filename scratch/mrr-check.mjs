import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[key] = value.trim();
    }
});

console.log('--- STRIPE CONFIGURATION ---');
const stripeKey = env['STRIPE_SECRET_KEY'];
console.log('Stripe Key length:', stripeKey?.length || 0);

// Initialize Supabase
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabase() {
    console.log('\n--- CHECKING SUPABASE SUBSCRIPTIONS ---');
    const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*');

    if (error) {
        console.error('Supabase Error:', error);
        return;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions in database:`);
    let dbMrr = 0;
    subscriptions.forEach((sub, i) => {
        let price = sub.tier === 'team' ? 199 : 99.99;
        if (sub.charter_pricing) price = price * 0.8;
        
        let contributes = false;
        if (sub.status === 'active' || sub.status === 'trialing') {
            dbMrr += price;
            contributes = true;
        }
        
        console.log(`[${i+1}] ID: ${sub.id || sub.subscription_id || 'N/A'}, User ID: ${sub.user_id}, Tier: ${sub.tier}, Status: ${sub.status}, Charter Pricing: ${sub.charter_pricing}, Calculated Price: $${price.toFixed(2)}, Contributes to MRR: ${contributes}`);
    });
    console.log(`Total DB Mock MRR: $${dbMrr.toFixed(2)}`);
}

async function checkStripe() {
    if (!stripeKey || stripeKey === 'your-stripe-secret-key') {
        console.log('\n--- STRIPE IS IN TEST MODE (MOCK) ---');
        return;
    }

    console.log('\n--- CHECKING LIVE STRIPE SUBSCRIPTIONS ---');
    const stripe = new Stripe(stripeKey, {
        apiVersion: '2026-01-28.clover',
    });

    try {
        let mrr = 0;
        let activeSubsCount = 0;
        let hasMore = true;
        let startingAfter = undefined;
        
        while (hasMore) {
            const page = await stripe.subscriptions.list({
                status: 'active',
                limit: 100,
                expand: ['data.items.data.price'],
                ...(startingAfter ? { starting_after: startingAfter } : {}),
            });
            
            for (const sub of page.data) {
                activeSubsCount++;
                let subMrr = 0;
                for (const item of sub.items.data) {
                    subMrr += (item.price.unit_amount ?? 0) / 100;
                }
                mrr += subMrr;
                console.log(`Stripe Sub ID: ${sub.id}, Created: ${new Date(sub.created * 1000).toISOString()}, Status: ${sub.status}, Sub MRR: $${subMrr.toFixed(2)}`);
            }
            
            hasMore = page.has_more;
            if (hasMore && page.data.length > 0) {
                startingAfter = page.data[page.data.length - 1].id;
            }
        }
        console.log(`Total Active Stripe Subs: ${activeSubsCount}`);
        console.log(`Total Live Stripe MRR: $${mrr.toFixed(2)}`);
    } catch (err) {
        console.error('Stripe Error:', err.message);
    }
}

async function run() {
    await checkSupabase();
    await checkStripe();
}

run();
