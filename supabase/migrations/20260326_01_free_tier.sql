-- =============================================
-- Migration: Add Free Tier & Change Default
-- =============================================

-- Update constraints to include 'free'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_tier_check CHECK (tier IN ('free', 'brother', 'team'));
ALTER TABLE public.users ALTER COLUMN tier SET DEFAULT 'free';

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier IN ('free', 'brother', 'team'));
ALTER TABLE public.subscriptions ALTER COLUMN tier SET DEFAULT 'free';

-- Update the handle_new_user function to default to 'free'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tier TEXT;
BEGIN
  -- Read tier from signup metadata, default to 'free'
  v_tier := COALESCE(NEW.raw_user_meta_data->>'tier', 'free');
  
  -- Validate tier value
  IF v_tier NOT IN ('free', 'brother', 'team') THEN
    v_tier := 'free';
  END IF;

  INSERT INTO public.users (id, email, display_name, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_tier
  );

  -- Auto-create subscription record if promo code was provided
  IF NEW.raw_user_meta_data->>'promo_code' IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, tier, status, charter_pricing, promo_code, current_period_start)
    VALUES (
      NEW.id,
      v_tier,
      'active',
      true,
      NEW.raw_user_meta_data->>'promo_code',
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tier = v_tier,
      status = 'active',
      promo_code = NEW.raw_user_meta_data->>'promo_code';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
