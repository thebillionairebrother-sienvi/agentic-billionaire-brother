/**
 * AI Middleware — Compose Pipeline
 *
 * buildAiContext() runs the full middleware chain and returns a validated
 * AiContext that API routes use to call Gemini with enforced guardrails.
 *
 * Usage in API routes:
 *   const ctx = await buildAiContext(supabase, user);
 *   // ctx.maxOutputTokens is now the hard-enforced token budget
 *   // ctx.isDegradeMode tells you if responses should be simplified
 */
import { SupabaseClient } from '@supabase/supabase-js';
import type { AiContext } from './types';
import { GuardError } from './types';
import { checkKillSwitch } from './kill-switch';
import { getSubscriptionInfo } from './subscription';
import { checkUsageGuard } from './usage-guard';
import { resolveTokenBudget } from './token-budget';
import { TIER_CONFIG, getTodayDate } from '@/lib/ai-config';
import type { Tier } from '@/lib/ai-config';
import { createServiceClient } from '@/lib/supabase/server';

interface BuildContextOptions {
    /** Set to true if this request is a regeneration */
    isRegen?: boolean;
    /** Override kill switch ID to check (defaults to 'ai_layer') */
    killSwitchId?: string;
}

/**
 * Build a validated AI context by running all middleware gates.
 * Throws GuardError if any gate fails.
 */
export async function buildAiContext(
    supabase: SupabaseClient,
    user: { id: string; email?: string },
    options: BuildContextOptions = {}
): Promise<AiContext> {
    const requestId = crypto.randomUUID();

    // 1. Kill switch check
    await checkKillSwitch(supabase, options.killSwitchId);

    // 2. Subscription lookup + billing validation
    const subscription = await getSubscriptionInfo(supabase, user.id);

    // 3. Usage guard — enforces all caps, detects degrade mode
    const usageResult = await checkUsageGuard(
        supabase,
        user.id,
        subscription.tier,
        { 
            isRegen: options.isRegen,
            email: subscription.email || user.email
        }
    );

    // 4. Resolve token budget based on tier + degrade state
    const maxOutputTokens = resolveTokenBudget(
        subscription.tier,
        usageResult.isDegradeMode
    );

    return {
        userId: user.id,
        email: user.email ?? '',
        tier: subscription.tier,
        subscriptionStatus: subscription.status,
        maxOutputTokens,
        isDegradeMode: usageResult.isDegradeMode,
        isHardStop: usageResult.isHardStop,
        requestId,
    };
}

/**
 * AI context for "exempt" routes (interview, strategy and task generation):
 * core flows that must not stall on the daily prompt cap.
 *
 * Still enforced: kill switch, monthly dollar cap, and the per-tier
 * daily_request_ceiling. Users whose subscription is inactive are capped as
 * free users instead of being waved through. The real tier is kept, so usage
 * is metered against the user's own caps.
 */
export async function buildExemptAiContext(
    supabase: SupabaseClient,
    user: { id: string; email?: string },
    options: { label: string; killSwitchId?: string }
): Promise<AiContext> {
    await checkKillSwitch(supabase, options.killSwitchId);

    let tier: Tier = 'free';
    let status: AiContext['subscriptionStatus'] = 'active';
    let email = user.email ?? '';
    try {
        const sub = await getSubscriptionInfo(supabase, user.id);
        tier = sub.tier;
        status = sub.status;
        email = sub.email || email;
    } catch (err) {
        if (!(err instanceof GuardError) || err.code !== 'BILLING_INACTIVE') throw err;
        console.warn(`[${options.label}] Subscription inactive, applying free-tier caps`);
        tier = 'free';
        status = 'past_due';
    }

    let isDegradeMode = true;
    try {
        const usage = await checkUsageGuard(supabase, user.id, tier, { email });
        isDegradeMode = usage.isDegradeMode;
    } catch (err) {
        // The daily prompt/regen caps are what exempt routes skip; anything else
        // (dollar cap, or a counter read failure) still stops the request.
        if (!(err instanceof GuardError) || !EXEMPTIBLE_GUARD_CODES.includes(err.code)) throw err;
        console.warn(`[${options.label}] Guardrail would block, but route is exempt:`, err.code);
    }

    if (!isUnlimitedEmail(email)) {
        await checkDailyRequestCeiling(user.id, tier);
    }

    return {
        userId: user.id,
        email,
        tier,
        subscriptionStatus: status,
        maxOutputTokens: resolveTokenBudget(tier, isDegradeMode),
        isDegradeMode,
        isHardStop: false,
        requestId: crypto.randomUUID(),
    };
}

const EXEMPTIBLE_GUARD_CODES = ['DAILY_CAP_EXCEEDED', 'REGEN_CAP_EXCEEDED'];

function isUnlimitedEmail(email: string): boolean {
    return email.toLowerCase() === 'scott@siemvi.com';
}

/**
 * Counts every logged Gemini call for the user today (exempt ones included,
 * since prompt_count leaves those out). Uses the service client so RLS on
 * request_logs can't make the count read as zero. Fails closed.
 */
async function checkDailyRequestCeiling(userId: string, tier: Tier): Promise<void> {
    const service = await createServiceClient();
    const { count, error } = await service
        .from('request_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', `${getTodayDate()}T00:00:00Z`);
    if (error) throw new Error(`request_logs count failed: ${error.message}`);

    if ((count ?? 0) >= TIER_CONFIG[tier].daily_request_ceiling) {
        throw new GuardError(
            'DAILY_REQUEST_CEILING',
            'Daily AI limit reached. Come back tomorrow.',
            429,
            false
        );
    }
}

export { GuardError };
export type { AiContext };
