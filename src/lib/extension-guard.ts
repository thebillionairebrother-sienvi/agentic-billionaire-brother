import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { checkKillSwitch } from '@/lib/middleware/kill-switch';
import { checkUsageGuard } from '@/lib/middleware/usage-guard';
import { GuardError } from '@/lib/middleware/types';
import type { Tier } from '@/lib/ai-config';
import { allowDuringUsageOutage, PLAN_UNVERIFIED_ERROR } from '@/lib/extension-auth';

/**
 * Shared gate for the extension's Gemini routes (/audit, /battle, /chat).
 * Returns a response to send when the request must stop, or null to continue.
 *
 *  1. Plan: paid plan required. If the plan couldn't be verified (DB outage and
 *     nothing cached) answer 503 so the panel retries instead of showing "upgrade".
 *  2. Kill switch: the global ai_layer switch stops the extension too.
 *  3. Usage caps: daily prompt + monthly $ caps. If the counters can't be read,
 *     allow only a few requests per user per hour instead of skipping the check.
 */
export async function guardExtensionAiRequest(opts: {
    serviceClient: any;
    user: User;
    plan: { tier: string; hasRequiredPlan: boolean; dbHealthy: boolean };
    corsHeaders: Record<string, string>;
    planRequiredMessage: string;
    label: string;
}): Promise<NextResponse | null> {
    const { serviceClient, user, plan, corsHeaders, planRequiredMessage, label } = opts;

    if (!plan.hasRequiredPlan) {
        if (!plan.dbHealthy) {
            return NextResponse.json({ error: PLAN_UNVERIFIED_ERROR, retryable: true }, { status: 503, headers: corsHeaders });
        }
        return NextResponse.json({ error: planRequiredMessage }, { status: 403, headers: corsHeaders });
    }

    try {
        await checkKillSwitch(serviceClient);
    } catch (err) {
        if (err instanceof GuardError) {
            return NextResponse.json({ error: err.message }, { status: err.statusCode || 503, headers: corsHeaders });
        }
        console.warn(`[${label}] Kill switch check failed (continuing):`, err);
    }

    const effectiveTier: Tier = plan.tier === 'team' ? 'team' : plan.tier === 'brother' ? 'brother' : 'free';
    try {
        await checkUsageGuard(serviceClient, user.id, effectiveTier, { email: user.email });
    } catch (guardErr: any) {
        if (guardErr instanceof GuardError) {
            return NextResponse.json({ error: guardErr.message }, { status: guardErr.statusCode || 429, headers: corsHeaders });
        }
        if (!allowDuringUsageOutage(user.id)) {
            console.warn(`[${label}] Usage counters unavailable and outage allowance used up for ${user.id}`);
            return NextResponse.json(
                { error: 'Usage limits cannot be checked right now (temporary server issue). Please try again in a few minutes.', retryable: true },
                { status: 503, headers: corsHeaders },
            );
        }
        console.warn(`[${label}] Usage counters unavailable, using outage allowance:`, guardErr?.message);
    }

    return null;
}
