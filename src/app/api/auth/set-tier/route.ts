import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/set-tier
 * Called immediately after signup to set the user's tier based on their promo code.
 * The promo code is validated client-side but we re-validate server-side for safety.
 */

const PROMO_CODES: Record<string, string> = {
    'BILLIONAIREBROTHER2026': 'brother',
    'BILLIONAIRETEAM2026': 'team',
};

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { promoCode } = await request.json();

        if (!promoCode || typeof promoCode !== 'string') {
            return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
        }

        const tier = PROMO_CODES[promoCode.toUpperCase().trim()];
        if (!tier) {
            return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
        }

        // Use service client to bypass RLS and set tier + create subscription
        const admin = await createServiceClient();

        // Update users table
        const { error: updateError } = await admin
            .from('users')
            .update({ tier })
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to set user tier:', updateError);
            return NextResponse.json({ error: 'Failed to set tier' }, { status: 500 });
        }

        // Upsert subscription record
        await admin
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                tier,
                status: 'active',
                charter_pricing: true,
                promo_code: promoCode.toUpperCase().trim(),
                started_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        return NextResponse.json({ success: true, tier });
    } catch (err) {
        console.error('Set tier error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
