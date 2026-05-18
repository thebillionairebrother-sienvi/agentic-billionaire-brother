-- =============================================
-- Revenue Tracking & Social Proof Screenshots
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 0: Create Supabase Storage bucket (do this in Supabase Dashboard):
-- ┌──────────────────────────────────────────────────────────────┐
-- │  Go to: Supabase Dashboard → Storage → New bucket            │
-- │  Bucket name: social-proof                                    │
-- │  Public: OFF (private bucket)                                 │
-- │  File size limit: 5MB                                         │
-- │  Allowed MIME types: image/jpeg, image/png, image/webp        │
-- │                                                               │
-- │  Then add RLS policies on the bucket:                         │
-- │  1. INSERT: Allow authenticated users to upload               │
-- │     Policy: (bucket_id = 'social-proof')                      │
-- │     AND (auth.role() = 'authenticated')                       │
-- │  2. SELECT: Allow authenticated users to read their own files │
-- │     Policy: (bucket_id = 'social-proof')                      │
-- │     AND (auth.uid()::text = (storage.foldername(name))[1])    │
-- │  3. SELECT: Allow service role to read all (for admin panel)  │
-- └──────────────────────────────────────────────────────────────┘

-- Add precise revenue tracking to business_profiles
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS baseline_monthly_revenue INTEGER,
  ADD COLUMN IF NOT EXISTS current_monthly_revenue INTEGER,
  ADD COLUMN IF NOT EXISTS revenue_platform TEXT,
  ADD COLUMN IF NOT EXISTS revenue_updated_at TIMESTAMPTZ;

-- Social proof / revenue wins table
CREATE TABLE IF NOT EXISTS public.revenue_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  monthly_revenue INTEGER,
  platform TEXT CHECK (platform IN ('stripe', 'paypal', 'gumroad', 'shopify', 'other')),
  win_headline TEXT,
  screenshot_path TEXT,
  consent_given BOOLEAN DEFAULT FALSE,
  admin_approved BOOLEAN DEFAULT FALSE,
  admin_rejected BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revenue_wins_user ON public.revenue_wins(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_wins_approved ON public.revenue_wins(admin_approved) WHERE admin_approved = TRUE;

-- RLS
ALTER TABLE public.revenue_wins ENABLE ROW LEVEL SECURITY;

-- Users can read their own wins
CREATE POLICY "rw_select_own" ON public.revenue_wins
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own wins
CREATE POLICY "rw_insert_own" ON public.revenue_wins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public read for approved wins only (for landing page social proof)
CREATE POLICY "rw_select_approved_public" ON public.revenue_wins
  FOR SELECT USING (admin_approved = TRUE);
