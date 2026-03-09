/**
 * AI Middleware — Token Budget
 * Sets the maxOutputTokens based on tier and degrade-mode state.
 * This value is passed directly to the Gemini SDK config.
 *
 * NOTE: Token limits disabled for now — returns undefined so Gemini uses its default max.
 * To re-enable, uncomment the body and revert the return type.
 */
import { TIER_CONFIG } from '@/lib/ai-config';
import type { Tier } from '@/lib/ai-config';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function resolveTokenBudget(tier: Tier, isDegradeMode: boolean): number | undefined {
    // const config = TIER_CONFIG[tier];
    // return isDegradeMode ? config.degrade_output_tokens : config.max_output_tokens;
    return undefined;
}
