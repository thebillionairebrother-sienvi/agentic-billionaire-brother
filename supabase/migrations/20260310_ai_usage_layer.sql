-- ==========================================================
-- AI Usage Layer — Database Migration
-- Run this against your Supabase project (SQL Editor)
-- ==========================================================

-- ─── 1. Modify existing users table ───
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'brother'
  CHECK (tier IN ('brother', 'team'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS charter_member BOOLEAN DEFAULT false;


-- ─── 2. Subscriptions ───
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier TEXT NOT NULL DEFAULT 'brother' CHECK (tier IN ('brother', 'team')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  charter_pricing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);


-- ─── 3. Feature Flags ───
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled_tiers TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default flags
INSERT INTO feature_flags (flag_key, description, enabled_tiers) VALUES
  ('web_search', 'Web search tool access', '{}'),
  ('tools', 'Tool call access', '{}'),
  ('regeneration', 'Allow regeneration of outputs', '{brother,team}'),
  ('workflows', 'Access to bounded workflows', '{brother,team}'),
  ('chat', 'Chat with Derek', '{brother,team}')
ON CONFLICT (flag_key) DO NOTHING;


-- ─── 4. Kill Switches ───
CREATE TABLE IF NOT EXISTS kill_switches (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  activated_by UUID REFERENCES users(id),
  activated_at TIMESTAMPTZ,
  reason TEXT
);

INSERT INTO kill_switches (id) VALUES
  ('ai_layer'), ('workflows'), ('tools')
ON CONFLICT (id) DO NOTHING;


-- ─── 5. Workflow Definitions ───
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  display_name TEXT NOT NULL,
  max_steps INTEGER NOT NULL,
  max_output_tokens INTEGER NOT NULL,
  allowed_tools TEXT[] DEFAULT '{}',
  retry_limit INTEGER NOT NULL DEFAULT 2,
  enabled BOOLEAN DEFAULT true,
  prompt_template TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, version)
);

-- Seed Phase 1 workflow definitions
INSERT INTO workflow_definitions (id, version, display_name, max_steps, max_output_tokens, retry_limit) VALUES
  ('revenue_bottleneck', 1, 'Revenue Bottleneck Diagnosis', 3, 3000, 2),
  ('revenue_path_ranking', 1, 'Revenue Path Ranking', 4, 4000, 2),
  ('sprint_pack_builder', 1, 'Sprint Pack Builder', 6, 6000, 2),
  ('kpi_spec_generator', 1, 'KPI Spec Generator', 3, 3000, 2),
  ('kill_keep_double', 1, 'Kill/Keep/Double Generator', 4, 4000, 2)
ON CONFLICT (id, version) DO NOTHING;


-- ─── 6. Workflow Runs ───
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  workflow_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'aborted')),
  steps_executed INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user ON workflow_runs(user_id);


-- ─── 7. Request Logs ───
CREATE TABLE IF NOT EXISTS request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workflow_run_id UUID REFERENCES workflow_runs(id),
  model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  endpoint TEXT NOT NULL,
  tier TEXT NOT NULL,
  degrade_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_date ON request_logs(user_id, created_at);


-- ─── 8. Usage: Daily per User ───
CREATE TABLE IF NOT EXISTS usage_daily_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  prompt_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  regen_count INTEGER DEFAULT 0,
  workflow_count INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  UNIQUE(user_id, date)
);


-- ─── 9. Usage: Weekly per User (regen tracking) ───
CREATE TABLE IF NOT EXISTS usage_weekly_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  regen_count INTEGER DEFAULT 0,
  UNIQUE(user_id, week_start)
);


-- ─── 10. Usage: Monthly per Workspace ───
CREATE TABLE IF NOT EXISTS usage_monthly_workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_start DATE NOT NULL,
  total_tokens INTEGER DEFAULT 0,
  total_prompts INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  regen_usage INTEGER DEFAULT 0,
  UNIQUE(user_id, month_start)
);


-- ─── 11. Revenue Events ───
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  join_date TIMESTAMPTZ NOT NULL,
  strategy_selected_date TIMESTAMPTZ,
  sprint_1_shipped_date TIMESTAMPTZ,
  revenue_event_date TIMESTAMPTZ,
  revenue_event_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─── 12. Cost Alerts ───
CREATE TABLE IF NOT EXISTS cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('warning', 'degrade', 'hard_stop', 'system')),
  threshold_pct NUMERIC(5,2),
  current_value NUMERIC(10,6),
  cap_value NUMERIC(10,6),
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─── 13. Audit Logs ───
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);


-- ==========================================================
-- RPC Functions for atomic counter increments
-- ==========================================================

-- Upsert + increment daily usage
CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_user_id UUID,
  p_prompts INTEGER DEFAULT 1,
  p_input_tokens INTEGER DEFAULT 0,
  p_output_tokens INTEGER DEFAULT 0,
  p_cost NUMERIC DEFAULT 0,
  p_is_regen BOOLEAN DEFAULT false,
  p_is_workflow BOOLEAN DEFAULT false
) RETURNS void AS $$
BEGIN
  INSERT INTO usage_daily_user (user_id, date, prompt_count, total_input_tokens, total_output_tokens, estimated_cost, regen_count, workflow_count)
  VALUES (p_user_id, CURRENT_DATE, p_prompts, p_input_tokens, p_output_tokens, p_cost,
    CASE WHEN p_is_regen THEN 1 ELSE 0 END,
    CASE WHEN p_is_workflow THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, date) DO UPDATE SET
    prompt_count = usage_daily_user.prompt_count + p_prompts,
    total_input_tokens = usage_daily_user.total_input_tokens + p_input_tokens,
    total_output_tokens = usage_daily_user.total_output_tokens + p_output_tokens,
    estimated_cost = usage_daily_user.estimated_cost + p_cost,
    regen_count = usage_daily_user.regen_count + CASE WHEN p_is_regen THEN 1 ELSE 0 END,
    workflow_count = usage_daily_user.workflow_count + CASE WHEN p_is_workflow THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql;


-- Upsert + increment weekly regen usage
CREATE OR REPLACE FUNCTION increment_weekly_regen(
  p_user_id UUID,
  p_week_start DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO usage_weekly_user (user_id, week_start, regen_count)
  VALUES (p_user_id, p_week_start, 1)
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    regen_count = usage_weekly_user.regen_count + 1;
END;
$$ LANGUAGE plpgsql;


-- Upsert + increment monthly usage
CREATE OR REPLACE FUNCTION increment_monthly_usage(
  p_user_id UUID,
  p_month_start DATE,
  p_tokens INTEGER DEFAULT 0,
  p_prompts INTEGER DEFAULT 1,
  p_cost NUMERIC DEFAULT 0,
  p_is_regen BOOLEAN DEFAULT false
) RETURNS void AS $$
BEGIN
  INSERT INTO usage_monthly_workspace (user_id, month_start, total_tokens, total_prompts, estimated_cost, regen_usage)
  VALUES (p_user_id, p_month_start, p_tokens, p_prompts, p_cost,
    CASE WHEN p_is_regen THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_tokens = usage_monthly_workspace.total_tokens + p_tokens,
    total_prompts = usage_monthly_workspace.total_prompts + p_prompts,
    estimated_cost = usage_monthly_workspace.estimated_cost + p_cost,
    regen_usage = usage_monthly_workspace.regen_usage + CASE WHEN p_is_regen THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql;
