-- =============================================
-- The Billionaire Brother — Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due')),
  subscription_plan TEXT DEFAULT 'founder',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Business profile from questionnaire
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_state TEXT CHECK (business_state IN ('idea', 'pre-revenue', 'revenue', 'scaling')),
  industry TEXT,
  current_revenue_range TEXT,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  hours_per_week INTEGER,
  monthly_budget_range TEXT,
  no_go_constraints JSONB DEFAULT '[]'::jsonb,
  target_audience TEXT,
  existing_assets JSONB DEFAULT '[]'::jsonb,
  additional_context TEXT,
  raw_answers JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Founder profile (personal constraints)
CREATE TABLE IF NOT EXISTS public.founder_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_size TEXT CHECK (team_size IN ('solo', 'founder_plus_vas', 'small_team')),
  va_count INTEGER DEFAULT 0,
  calendar_blocks_available INTEGER,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Decision (one per strategy generation cycle)
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_profile_id UUID REFERENCES public.business_profiles(id),
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'chosen', 'expired')),
  chosen_strategy_id UUID,
  thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  chosen_at TIMESTAMPTZ
);

-- Strategy options (3 per decision)
CREATE TABLE IF NOT EXISTS public.strategy_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  archetype TEXT NOT NULL,
  thesis TEXT NOT NULL,
  channel_focus JSONB DEFAULT '[]'::jsonb,
  offer_shape TEXT,
  first_7_day_plan JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  mitigations JSONB DEFAULT '[]'::jsonb,
  kpis JSONB DEFAULT '[]'::jsonb,
  decision_score INTEGER CHECK (decision_score BETWEEN 0 AND 100),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  score_breakdown JSONB,
  assumptions JSONB DEFAULT '[]'::jsonb,
  raw_ai_output JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Execution contract (after forced choice)
CREATE TABLE IF NOT EXISTS public.execution_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.decisions(id),
  strategy_id UUID NOT NULL REFERENCES public.strategy_options(id),
  locked_kpi TEXT NOT NULL,
  weekly_deliverable TEXT NOT NULL,
  calendar_blocks INTEGER NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly cycles
CREATE TABLE IF NOT EXISTS public.weekly_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  execution_contract_id UUID REFERENCES public.execution_contracts(id),
  week_number INTEGER NOT NULL,
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'active', 'completed')),
  kpi_target TEXT,
  kpi_actual TEXT,
  board_meeting_notes JSONB,
  kill_list JSONB,
  keep_list JSONB,
  double_list JSONB,
  thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Deliverables (2 big + 5 small per week)
CREATE TABLE IF NOT EXISTS public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_cycle_id UUID NOT NULL REFERENCES public.weekly_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department TEXT NOT NULL CHECK (department IN ('competitive_intel', 'copy_conversion', 'seo_demand', 'business_plan', 'content_distribution', 'red_team')),
  title TEXT NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('big', 'small')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'approved', 'rejected')),
  content JSONB,
  red_team_passed BOOLEAN,
  red_team_feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual tasks within deliverables
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID REFERENCES public.deliverables(id) ON DELETE SET NULL,
  weekly_cycle_id UUID NOT NULL REFERENCES public.weekly_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT DEFAULT 'founder',
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')),
  due_date DATE,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated assets
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID REFERENCES public.deliverables(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('document', 'copy_block', 'checklist', 'template', 'brief')),
  title TEXT NOT NULL,
  content JSONB,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assumptions
CREATE TABLE IF NOT EXISTS public.assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_option_id UUID REFERENCES public.strategy_options(id) ON DELETE CASCADE,
  weekly_cycle_id UUID REFERENCES public.weekly_cycles(id) ON DELETE CASCADE,
  assumption_text TEXT NOT NULL,
  category TEXT CHECK (category IN ('market', 'resource', 'timing', 'financial')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generation jobs (async queue tracking)
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('strategies', 'brief', 'ship_pack', 'board_meeting', 'deliverable')),
  reference_id UUID,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_business_profiles_user ON public.business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_profiles_user ON public.founder_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_user ON public.decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_options_decision ON public.strategy_options(decision_id);
CREATE INDEX IF NOT EXISTS idx_execution_contracts_user ON public.execution_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_contract ON public.weekly_cycles(execution_contract_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_cycle ON public.deliverables(weekly_cycle_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cycle ON public.tasks(weekly_cycle_id);
CREATE INDEX IF NOT EXISTS idx_assets_deliverable ON public.assets(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user ON public.generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Business profiles: own rows only
CREATE POLICY "bp_select_own" ON public.business_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bp_insert_own" ON public.business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bp_update_own" ON public.business_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Founder profiles: own rows only
CREATE POLICY "fp_select_own" ON public.founder_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fp_insert_own" ON public.founder_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fp_update_own" ON public.founder_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Decisions: own rows only
CREATE POLICY "decisions_select_own" ON public.decisions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "decisions_insert_own" ON public.decisions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "decisions_update_own" ON public.decisions FOR UPDATE USING (auth.uid() = user_id);

-- Strategy options: through decision ownership
CREATE POLICY "so_select_own" ON public.strategy_options FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.decisions d WHERE d.id = decision_id AND d.user_id = auth.uid()));
CREATE POLICY "so_insert_own" ON public.strategy_options FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.decisions d WHERE d.id = decision_id AND d.user_id = auth.uid()));

-- Execution contracts: own rows
CREATE POLICY "ec_select_own" ON public.execution_contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ec_insert_own" ON public.execution_contracts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Weekly cycles: own rows
CREATE POLICY "wc_select_own" ON public.weekly_cycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wc_insert_own" ON public.weekly_cycles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wc_update_own" ON public.weekly_cycles FOR UPDATE USING (auth.uid() = user_id);

-- Deliverables: own rows
CREATE POLICY "del_select_own" ON public.deliverables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "del_insert_own" ON public.deliverables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "del_update_own" ON public.deliverables FOR UPDATE USING (auth.uid() = user_id);

-- Tasks: own rows
CREATE POLICY "tasks_select_own" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);

-- Assets: own rows
CREATE POLICY "assets_select_own" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "assets_insert_own" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Assumptions: through strategy/cycle ownership
CREATE POLICY "assumptions_select" ON public.assumptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.strategy_options so JOIN public.decisions d ON d.id = so.decision_id WHERE so.id = strategy_option_id AND d.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.weekly_cycles wc WHERE wc.id = weekly_cycle_id AND wc.user_id = auth.uid())
  );
CREATE POLICY "assumptions_insert" ON public.assumptions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.strategy_options so JOIN public.decisions d ON d.id = so.decision_id WHERE so.id = strategy_option_id AND d.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.weekly_cycles wc WHERE wc.id = weekly_cycle_id AND wc.user_id = auth.uid())
  );

-- Generation jobs: own rows
CREATE POLICY "gj_select_own" ON public.generation_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gj_insert_own" ON public.generation_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Audit logs: own rows (select only)
CREATE POLICY "al_select_own" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- Trigger: Auto-create public.users on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Trigger: Auto-update updated_at timestamps
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER bp_updated_at BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
