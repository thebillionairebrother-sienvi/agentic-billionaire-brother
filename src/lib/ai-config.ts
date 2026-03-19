/**
 * AI Usage Layer — Tier Entitlements, Cost Constants, and Policy Config
 *
 * NON-NEGOTIABLE: These values are system law. Do not soften caps,
 * add tiers, or enable tools/search without explicit business approval.
 */

// ─── Tier Types ───
export type Tier = 'brother' | 'team';

// ─── Tier Entitlements ───
export interface TierEntitlements {
    daily_prompt_cap: number;
    max_output_tokens: number;
    max_workflow_steps: number;
    weekly_regen_cap: number;
    monthly_dollar_cap: number;
    degrade_output_tokens: number;
    tools_enabled: boolean;
    search_enabled: boolean;
}

export const TIER_CONFIG: Record<Tier, TierEntitlements> = {
    brother: {
        daily_prompt_cap: 40,
        max_output_tokens: 4096,
        max_workflow_steps: 6,
        weekly_regen_cap: 2,
        monthly_dollar_cap: 50.0,
        degrade_output_tokens: 2048,
        tools_enabled: false,
        search_enabled: false,
    },
    team: {
        daily_prompt_cap: 100,
        max_output_tokens: 8192,
        max_workflow_steps: 10,
        weekly_regen_cap: 4,
        monthly_dollar_cap: 150.0,
        degrade_output_tokens: 4096,
        tools_enabled: false,
        search_enabled: false,
    },
};

// ─── Pricing ───
// Budget pricing (2.5× safety margin) used for cap enforcement
// Actual pricing used for cost reporting only
// Model: gemini-3-pro-preview
export const MODEL_PRICING = {
    model: 'gemini-3-pro-preview' as const,
    actual: {
        input_per_1m_tokens: 1.25,
        output_per_1m_tokens: 10.00,
    },
    budget: {
        input_per_1m_tokens: 3.125,
        output_per_1m_tokens: 25.00,
    },
};

// ─── Degrade / Alert Thresholds ───
export const THRESHOLDS = {
    warning_pct: 0.60,
    degrade_pct: 0.80,
    hard_stop_pct: 1.00,
    severe_pct: 1.20,
    per_user_cost_alert: 60.0,
    target_gross_margin: 0.85,
    blended_expected_cost_per_user: 20.0,
};

// ─── Retry Policy ───
export const RETRY_POLICY = {
    max_retries_per_step: 2,
    retry_delay_ms: 1000,
    backoff_multiplier: 2,
    max_retry_delay_ms: 4000,
};

// ─── Workflow Definitions ───
export interface WorkflowPolicy {
    id: string;
    display_name: string;
    max_steps: number;
    retry_limit: number;
    allowed_tools: string[];
    enabled: boolean;
}

export const WORKFLOW_POLICIES: Record<string, WorkflowPolicy> = {
    revenue_bottleneck: {
        id: 'revenue_bottleneck',
        display_name: 'Revenue Bottleneck Diagnosis',
        max_steps: 3,
        retry_limit: 2,
        allowed_tools: [],
        enabled: true,
    },
    revenue_path_ranking: {
        id: 'revenue_path_ranking',
        display_name: 'Revenue Path Ranking',
        max_steps: 4,
        retry_limit: 2,
        allowed_tools: [],
        enabled: true,
    },
    sprint_pack_builder: {
        id: 'sprint_pack_builder',
        display_name: 'Sprint Pack Builder',
        max_steps: 6,
        retry_limit: 2,
        allowed_tools: [],
        enabled: true,
    },
    kpi_spec_generator: {
        id: 'kpi_spec_generator',
        display_name: 'KPI Spec Generator',
        max_steps: 3,
        retry_limit: 2,
        allowed_tools: [],
        enabled: true,
    },
    kill_keep_double: {
        id: 'kill_keep_double',
        display_name: 'Kill/Keep/Double Generator',
        max_steps: 4,
        retry_limit: 2,
        allowed_tools: [],
        enabled: true,
    },
};

// ─── Tool Policy (future — everything disabled Phase 1) ───
export const TOOL_POLICY = {
    max_tool_calls_per_request: 2,
    monthly_tool_quota: { brother: 20, team: 50 } as Record<Tier, number>,
    daily_tool_burst_cap: { brother: 5, team: 10 } as Record<Tier, number>,
    enabled_tools: [] as string[],
};

// ─── Kill Switch IDs ───
export const KILL_SWITCH_IDS = {
    AI_LAYER: 'ai_layer',
    WORKFLOWS: 'workflows',
    TOOLS: 'tools',
} as const;

// ─── Thinking Config (gemini-3-pro-preview) ───
// Maps endpoints to thinking levels for optimal cost/quality tradeoff
export const THINKING_LEVELS = {
    // Heavy analysis — full reasoning
    '/api/strategies/generate': 'HIGH',
    '/api/workers/ship-pack-generator': 'HIGH',
    // Moderate reasoning — structured extraction + generation
    '/api/tasks/generate': 'MEDIUM',
    '/api/tasks/derek': 'MEDIUM',
    '/api/weekly-checkin/summary': 'MEDIUM',
    '/api/cron/generate-tasks': 'MEDIUM',
    '/api/interview': 'LOW',
    // Lightweight — conversational responses
    '/api/chat': 'LOW',
    '/api/weekly-checkin': 'LOW',
} as const;

export type ThinkingLevelValue = typeof THINKING_LEVELS[keyof typeof THINKING_LEVELS];

// ─── Cost Helpers ───
export function calculateEstimatedCost(
    inputTokens: number,
    outputTokens: number
): { actual: number; budgeted: number } {
    return {
        actual:
            (inputTokens / 1_000_000) * MODEL_PRICING.actual.input_per_1m_tokens +
            (outputTokens / 1_000_000) * MODEL_PRICING.actual.output_per_1m_tokens,
        budgeted:
            (inputTokens / 1_000_000) * MODEL_PRICING.budget.input_per_1m_tokens +
            (outputTokens / 1_000_000) * MODEL_PRICING.budget.output_per_1m_tokens,
    };
}

/**
 * Get the first day of the current month (for monthly usage keys).
 */
export function getCurrentMonthStart(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get the Monday of the current week (for weekly regen keys).
 */
export function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
}

/**
 * Get today's date string (for daily usage keys).
 */
export function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get the next billing reset date (1st of next month).
 */
export function getNextResetDate(): string {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}
