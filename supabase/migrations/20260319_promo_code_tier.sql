-- =============================================
-- Migration: Update handle_new_user to read tier from signup metadata
-- Also adds promo_code column to subscriptions if missing
-- =============================================

-- Add promo_code column to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- Update the trigger function to read tier from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tier TEXT;
BEGIN
  -- Read tier from signup metadata, default to 'brother'
  v_tier := COALESCE(NEW.raw_user_meta_data->>'tier', 'brother');
  
  -- Validate tier value
  IF v_tier NOT IN ('brother', 'team') THEN
    v_tier := 'brother';
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
    INSERT INTO public.subscriptions (user_id, tier, status, charter_pricing, promo_code, started_at)
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
