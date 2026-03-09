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
        { isRegen: options.isRegen }
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

export { GuardError };
export type { AiContext };
