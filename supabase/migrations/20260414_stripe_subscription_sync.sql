-- ─── Stripe Subscription Sync Migration ───
-- Adds stripe_subscription_id and current_period_end to subscriptions table.
-- Non-destructive: uses IF NOT EXISTS for all alterations.
-- Date: 2026-04-14

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for fast webhook lookups by stripe_subscription_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id
    ON subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- Ensure users table has stripe_customer_id indexed for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
    ON users(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- Add trialing as a valid subscription_status if not already present
DO $$
BEGIN
    -- Only attempt if subscription_status is an enum type; skip if it's a plain text column
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'subscription_status'
    ) THEN
        BEGIN
            ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trialing';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END
$$;
