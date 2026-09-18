-- ============================================================
-- Derek for Chrome — Voluntary Lead Capture Migration
-- Table: public.lead_subscriptions
-- Date: 2026-09-18
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT true,
    source TEXT NOT NULL DEFAULT 'derek_for_chrome_popup',
    variant TEXT,
    device_type TEXT,
    trigger_type TEXT,
    page_path TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    synced_to_sender BOOLEAN DEFAULT false,
    sender_recipient_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lookup and deduplication / analytics
CREATE INDEX IF NOT EXISTS idx_lead_subscriptions_email ON public.lead_subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_lead_subscriptions_created_at ON public.lead_subscriptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_subscriptions_source ON public.lead_subscriptions (source);

-- Enable RLS
ALTER TABLE public.lead_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DO $$ BEGIN
    CREATE POLICY "Service role full access on lead_subscriptions"
        ON public.lead_subscriptions
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow anonymous insertion of voluntary email leads
DO $$ BEGIN
    CREATE POLICY "Allow public insert on lead_subscriptions"
        ON public.lead_subscriptions
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
