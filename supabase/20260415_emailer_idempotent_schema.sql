-- ============================================================
-- IDEMPOTENT (SAFE TO RUN) SCHEMA MIGRATION FOR SIENVI RESEND EMAILER
-- Run this entire script in your Supabase SQL Editor.
-- It will automatically skip any tables/policies/triggers that already exist.
-- ============================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  name text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  tags text[],
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  consent boolean DEFAULT false
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 3. Email campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own campaigns" ON public.email_campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 4. Email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sequence_order int NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own templates" ON public.email_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 5. Email sends tracking
CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.email_templates(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sent_at timestamptz DEFAULT now() NOT NULL,
  opened boolean DEFAULT false,
  clicked boolean DEFAULT false
);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own email sends" ON public.email_sends FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 6. Customer behavior events
CREATE TABLE IF NOT EXISTS public.customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own events" ON public.customer_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_campaign_id ON public.email_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sends_customer_id ON public.email_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_customer_id ON public.customer_events(customer_id);


-- 7. sender_identities table
CREATE TABLE IF NOT EXISTS public.sender_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name text NOT NULL,
  from_email text NOT NULL,
  domain text GENERATED ALWAYS AS (split_part(from_email, '@', 2)) STORED,
  dkim_verified boolean DEFAULT false,
  spf_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sender_identities_user_idx ON public.sender_identities(user_id);

ALTER TABLE public.sender_identities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own sender identities" ON public.sender_identities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 8. suppressions table
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext NOT NULL,
  reason text NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint','manual')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS suppressions_user_email_idx ON public.suppressions(user_id, email);

ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own suppressions" ON public.suppressions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 9. campaign_schedules table
CREATE TABLE IF NOT EXISTS public.campaign_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email_template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL CHECK (sequence_order BETWEEN 1 AND 5),
  scheduled_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Edmonton',
  approved boolean DEFAULT false,
  dispatched boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, email_template_id)
);

CREATE INDEX IF NOT EXISTS campaign_schedules_due_idx
  ON public.campaign_schedules(approved, dispatched, scheduled_at)
  WHERE approved = true AND dispatched = false;

CREATE INDEX IF NOT EXISTS campaign_schedules_campaign_idx
  ON public.campaign_schedules(campaign_id);

ALTER TABLE public.campaign_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own campaign schedules"
    ON public.campaign_schedules
    FOR ALL
    USING (
      EXISTS(SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_schedules.campaign_id AND ec.user_id = auth.uid())
    )
    WITH CHECK (
      EXISTS(SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_schedules.campaign_id AND ec.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 10. Enable Realtime for email_sends
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.email_sends;
EXCEPTION 
  WHEN duplicate_object THEN NULL; 
END $$;


-- 11. customer_groups, customer_group_memberships, campaign_target_groups
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.customer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_group_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_target_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, group_id)
);

ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_target_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own groups" ON public.customer_groups FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage memberships for own customers" ON public.customer_group_memberships FOR ALL
    USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_group_memberships.customer_id AND c.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_group_memberships.customer_id AND c.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage target groups for own campaigns" ON public.campaign_target_groups FOR ALL
    USING (EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_target_groups.campaign_id AND ec.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_target_groups.campaign_id AND ec.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_customer_groups_updated_at BEFORE UPDATE ON public.customer_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 12. campaign_target_customers table
CREATE TABLE IF NOT EXISTS public.campaign_target_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, customer_id)
);

ALTER TABLE public.campaign_target_customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage target customers for own campaigns" ON public.campaign_target_customers FOR ALL
    USING (EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_target_customers.campaign_id AND ec.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_target_customers.campaign_id AND ec.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_target_customers_campaign ON public.campaign_target_customers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_target_customers_customer ON public.campaign_target_customers(customer_id);


-- 13. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('email-images', 'email-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Users can upload email images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'email-images' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view their own email images" ON storage.objects FOR SELECT USING (bucket_id = 'email-images' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public can view email images" ON storage.objects FOR SELECT USING (bucket_id = 'email-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own email images" ON storage.objects FOR DELETE USING (bucket_id = 'email-images' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload email attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public can view email attachments" ON storage.objects FOR SELECT USING (bucket_id = 'email-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own email attachments" ON storage.objects FOR DELETE USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
