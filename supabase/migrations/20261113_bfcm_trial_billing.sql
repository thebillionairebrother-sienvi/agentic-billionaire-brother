-- =====================================================================
-- BFCM 2026 trial + billing hardening
-- Date: 2026-11-13
-- Non-destructive: adds columns/table, widens a CHECK, and stops the
-- signup trigger from trusting client-supplied tier/promo metadata.
-- =====================================================================

-- 1. Allow 'trialing' in users.subscription_status.
--    001_initial_schema.sql created a CHECK that only allowed
--    none/active/cancelled/past_due, so every Stripe trial sync failed.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_subscription_status_check
    CHECK (subscription_status IN ('none', 'active', 'trialing', 'past_due', 'cancelled'));

-- 2. Extra Stripe state on subscriptions.
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;

-- 3. Trial enrollments: one row per user per offer, with recorded consent.
CREATE TABLE IF NOT EXISTS public.trial_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'cancelled', 'converted', 'ended', 'payment_failed')),
    plan TEXT NOT NULL CHECK (plan IN ('brother', 'team')),
    stripe_customer_id TEXT,
    stripe_checkout_session_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    price_amount INTEGER NOT NULL,          -- cents shown to the user
    currency TEXT NOT NULL,
    billing_interval TEXT NOT NULL,         -- 'month'
    first_charge_at TIMESTAMPTZ NOT NULL,   -- trial end disclosed to the user
    terms_version TEXT NOT NULL,
    consent_text TEXT NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL,
    consent_ip TEXT,
    consent_user_agent TEXT,
    utm JSONB,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_trial_enrollments_reminder
    ON public.trial_enrollments (first_charge_at)
    WHERE status = 'active' AND reminder_sent_at IS NULL;

ALTER TABLE public.trial_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_enrollments_select_own" ON public.trial_enrollments;
CREATE POLICY "trial_enrollments_select_own" ON public.trial_enrollments
    FOR SELECT USING (auth.uid() = user_id);
-- Writes happen only through the service role (API routes / webhooks).

-- 4. Signup trigger: never trust client metadata for tier or promo.
--    Previously anyone could call supabase.auth.signUp with
--    data: { tier: 'team' } and get the Team plan without paying.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'free'
  );
  -- Paid access is granted only by the Stripe webhook (or, until the beta
  -- program ends, by /api/auth/set-tier after server-side code validation).
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
