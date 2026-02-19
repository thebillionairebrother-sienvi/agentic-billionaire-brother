/* ========================================
   Database & API Types
   ======================================== */

// ─── Users ───
export interface User {
    id: string;
    email: string;
    display_name: string | null;
    stripe_customer_id: string | null;
    subscription_status: 'none' | 'active' | 'cancelled' | 'past_due';
    subscription_plan: string;
    onboarding_complete: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Business Profile ───
export interface BusinessProfile {
    id: string;
    user_id: string;
    business_name: string | null;
    business_state: 'idea' | 'pre-revenue' | 'revenue' | 'scaling';
    industry: string | null;
    current_revenue_range: string | null;
    strengths: string[];
    weaknesses: string[];
    risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
    hours_per_week: number;
    monthly_budget_range: string | null;
    no_go_constraints: string[];
    target_audience: string | null;
    existing_assets: string[];
    additional_context: string | null;
    raw_answers: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// ─── Founder Profile ───
export interface FounderProfile {
    id: string;
    user_id: string;
    team_size: 'solo' | 'founder_plus_vas' | 'small_team';
    va_count: number;
    calendar_blocks_available: number;
    timezone: string | null;
    created_at: string;
}

// ─── Decision ───
export interface Decision {
    id: string;
    user_id: string;
    business_profile_id: string | null;
    status: 'generating' | 'ready' | 'chosen' | 'expired';
    chosen_strategy_id: string | null;
    thread_id: string | null;
    created_at: string;
    chosen_at: string | null;
}

// ─── Strategy Option ───
export interface StrategyOption {
    id: string;
    decision_id: string;
    rank: number;
    archetype: string;
    thesis: string;
    channel_focus: string[];
    offer_shape: string;
    first_7_day_plan: DayPlan[];
    risks: string[];
    mitigations: string[];
    kpis: string[];
    decision_score: number;
    confidence: 'high' | 'medium' | 'low';
    score_breakdown: ScoreBreakdown;
    assumptions: Assumption[];
    raw_ai_output: Record<string, unknown> | null;
    created_at: string;
}

export interface DayPlan {
    day: number;
    task: string;
    owner: string;
    time_mins: number;
}

export interface ScoreBreakdown {
    breakdown: ScoreCategory[];
    disclaimer: string;
}

export interface ScoreCategory {
    category: string;
    weight: number;
    score: number;
    weighted_score: number;
    rationale: string;
}

export interface Assumption {
    text: string;
    category: 'market' | 'resource' | 'timing' | 'financial';
    risk_level: 'low' | 'medium' | 'high';
}

// ─── Execution Contract ───
export interface ExecutionContract {
    id: string;
    user_id: string;
    decision_id: string;
    strategy_id: string;
    locked_kpi: string;
    weekly_deliverable: string;
    calendar_blocks: number;
    signed_at: string;
}

// ─── Weekly Cycle ───
export interface WeeklyCycle {
    id: string;
    user_id: string;
    execution_contract_id: string | null;
    week_number: number;
    status: 'generating' | 'active' | 'completed';
    kpi_target: string | null;
    kpi_actual: string | null;
    board_meeting_notes: Record<string, unknown> | null;
    kill_list: string[] | null;
    keep_list: string[] | null;
    double_list: string[] | null;
    thread_id: string | null;
    created_at: string;
    completed_at: string | null;
}

// ─── Deliverable ───
export type Department =
    | 'competitive_intel'
    | 'copy_conversion'
    | 'seo_demand'
    | 'business_plan'
    | 'content_distribution'
    | 'red_team';

export interface Deliverable {
    id: string;
    weekly_cycle_id: string;
    user_id: string;
    department: Department;
    title: string;
    size: 'big' | 'small';
    status: 'pending' | 'generating' | 'ready' | 'approved' | 'rejected';
    content: Record<string, unknown> | null;
    red_team_passed: boolean | null;
    red_team_feedback: Record<string, unknown> | null;
    created_at: string;
}

// ─── Task ───
export interface Task {
    id: string;
    deliverable_id: string | null;
    weekly_cycle_id: string;
    user_id: string;
    title: string;
    description: string | null;
    assignee: string;
    status: 'todo' | 'in_progress' | 'done' | 'skipped';
    due_date: string | null;
    sort_order: number | null;
    created_at: string;
}

// ─── Asset ───
export interface Asset {
    id: string;
    deliverable_id: string | null;
    user_id: string;
    asset_type: 'document' | 'copy_block' | 'checklist' | 'template' | 'brief';
    title: string;
    content: Record<string, unknown> | null;
    storage_path: string | null;
    created_at: string;
}

// ─── Generation Job ───
export type JobType = 'strategies' | 'brief' | 'ship_pack' | 'board_meeting' | 'deliverable';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface GenerationJob {
    id: string;
    user_id: string;
    job_type: JobType;
    reference_id: string | null;
    status: JobStatus;
    attempts: number;
    max_attempts: number;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

// ─── API Request/Response Types ───

export interface QuestionnairePayload {
    business_name: string;
    business_state: BusinessProfile['business_state'];
    industry: string;
    current_revenue_range: string;
    strengths: string[];
    weaknesses: string[];
    risk_tolerance: BusinessProfile['risk_tolerance'];
    hours_per_week: number;
    monthly_budget_range: string;
    no_go_constraints: string[];
    target_audience: string;
    existing_assets: string[];
    additional_context: string;
    team_size: FounderProfile['team_size'];
    va_count: number;
    calendar_blocks_available: number;
    timezone: string;
}

export interface CommitPayload {
    decision_id: string;
    strategy_option_id: string;
    locked_kpi: string;
    weekly_deliverable: string;
    calendar_blocks: number;
}

export interface BoardMeetingPayload {
    cycle_id: string;
    kpi_actual: string;
    kill_list: string[];
    keep_list: string[];
    double_list: string[];
    notes: string;
}

// ─── Red Team QA ───
export interface RedTeamFlag {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: 'legal' | 'claims' | 'feasibility' | 'assumptions' | 'time' | 'budget' | 'disclaimers' | 'ethics';
    message: string;
    affected_section: string;
    suggested_fix: string;
}

export interface RedTeamResult {
    department: 'red_team_qa';
    overall_verdict: 'pass' | 'fail';
    flags: RedTeamFlag[];
    missing_assumptions: string[];
    missing_disclaimers: string[];
}

// ─── Interview Chat ───
export interface InterviewMessage {
    role: 'user' | 'assistant';
    content: string;
    reaction?: string;
}

export interface InterviewResponse {
    reply: string;
    reaction?: string;
    threadId: string;
    complete: boolean;
    extractedData?: QuestionnairePayload;
}
