/**
 * AI Middleware — Shared Types
 */
import type { Tier } from '@/lib/ai-config';

// ─── AI Request Context (threaded through middleware) ───
export interface AiContext {
    userId: string;
    email: string;
    tier: Tier;
    subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'trialing';
    maxOutputTokens: number | undefined;
    isDegradeMode: boolean;
    isHardStop: boolean;
    requestId: string;
}

// ─── Usage Snapshots ───
export interface DailyUsage {
    prompt_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    regen_count: number;
    workflow_count: number;
    estimated_cost: number;
}

export interface WeeklyUsage {
    regen_count: number;
}

export interface MonthlyUsage {
    total_tokens: number;
    total_prompts: number;
    estimated_cost: number;
    regen_usage: number;
}

// ─── Guard Error (thrown by middleware, caught in route) ───
export class GuardError extends Error {
    constructor(
        public code: string,
        public userMessage: string,
        public statusCode: number = 403,
        public retryAllowed: boolean = false
    ) {
        super(userMessage);
        this.name = 'GuardError';
    }
}

// ─── Guard Response Helper ───
export function guardErrorResponse(error: GuardError) {
    return {
        error_code: error.code,
        user_message: error.userMessage,
        retry_allowed: error.retryAllowed,
    };
}
