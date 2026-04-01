import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/set-tier
 * Called immediately after signup to set the user's tier based on their promo code.
 * If no promo code is provided, defaults to 'free' tier.
 */

const PROMO_CODES: Record<string, string> = {
    'BILLIONAIREBROTHER2026': 'brother',
    'BILLIONAIRETEAM2026': 'team',
};

export async function POST(request: Request) {
    try {
        const { supabase: _sb, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { promoCode, tier: requestedTier } = body;

        // Determine tier: promo code validation takes priority, then explicit tier, then default to free
        let tier = 'free';

        if (promoCode && typeof promoCode === 'string') {
            const matched = PROMO_CODES[promoCode.toUpperCase().trim()];
            if (!matched) {
                return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
            }
            tier = matched;
        } else if (requestedTier === 'free') {
            tier = 'free';
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
                charter_pricing: tier !== 'free',
                promo_code: promoCode ? promoCode.toUpperCase().trim() : null,
                started_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        return NextResponse.json({ success: true, tier });
    } catch (err) {
        console.error('Set tier error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

