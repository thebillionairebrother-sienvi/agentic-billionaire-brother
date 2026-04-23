-- =============================================
-- Admin-Only Email Marketing System Schema
-- =============================================

-- 1. Profiles (for role-based access)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when auth.user is created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile') THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();
  END IF;
END $$;

-- 2. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  consent_given BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

-- 3. Customer Groups
CREATE TABLE IF NOT EXISTS public.customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Customer Group Memberships
CREATE TABLE IF NOT EXISTS public.customer_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.customer_groups ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, customer_id)
);

-- 5. Email Campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  campaign_type TEXT DEFAULT 'group' CHECK (campaign_type IN ('group', 'individual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Campaign Target Groups
CREATE TABLE IF NOT EXISTS public.campaign_target_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.customer_groups ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, group_id)
);

-- 8. Campaign Target Customers (for individual sends)
CREATE TABLE IF NOT EXISTS public.campaign_target_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, customer_id)
);

-- 9. Campaign Schedules
CREATE TABLE IF NOT EXISTS public.campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.email_templates ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  dispatched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Email Sends (Audit log of dispatched emails)
CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.email_templates ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered', 'bounced')),
  error_message TEXT
);

-- 11. Customer Events (Opens, Clicks)
CREATE TABLE IF NOT EXISTS public.customer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  send_id UUID REFERENCES public.email_sends ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'unsubscribe')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Sender Identities
CREATE TABLE IF NOT EXISTS public.sender_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  domain TEXT,
  spf_verified BOOLEAN DEFAULT false,
  dkim_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Suppressions (Unsubscribes/Bounces)
CREATE TABLE IF NOT EXISTS public.suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

-- =============================================
-- RLS Policies (Admin-only access)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_target_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_target_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sender_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: users can read their own profile, admins can read all
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Customers: admins only (filtered by user_id for multi-tenant safety if needed, assuming owner is admin)
CREATE POLICY "customers_admin_all" ON public.customers FOR ALL USING (auth.uid() = user_id AND public.is_admin());
CREATE POLICY "customer_groups_admin_all" ON public.customer_groups FOR ALL USING (auth.uid() = user_id AND public.is_admin());

-- Memberships: indirect ownership check via groups
CREATE POLICY "customer_group_memberships_admin_all" ON public.customer_group_memberships FOR ALL USING (
  EXISTS (SELECT 1 FROM public.customer_groups cg WHERE cg.id = group_id AND cg.user_id = auth.uid()) 
  AND public.is_admin()
);

CREATE POLICY "email_campaigns_admin_all" ON public.email_campaigns FOR ALL USING (auth.uid() = user_id AND public.is_admin());

-- Templates: indirect ownership via campaigns
CREATE POLICY "email_templates_admin_all" ON public.email_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_id AND ec.user_id = auth.uid())
  AND public.is_admin()
);

CREATE POLICY "campaign_target_groups_admin_all" ON public.campaign_target_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_id AND ec.user_id = auth.uid())
  AND public.is_admin()
);

CREATE POLICY "campaign_target_customers_admin_all" ON public.campaign_target_customers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_id AND ec.user_id = auth.uid())
  AND public.is_admin()
);

CREATE POLICY "campaign_schedules_admin_all" ON public.campaign_schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_id AND ec.user_id = auth.uid())
  AND public.is_admin()
);

-- Sends: indirect ownership via campaigns
CREATE POLICY "email_sends_admin_all" ON public.email_sends FOR ALL USING (
  EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_id AND ec.user_id = auth.uid())
  AND public.is_admin()
);

-- Events: indirect ownership via customers
CREATE POLICY "customer_events_admin_all" ON public.customer_events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  AND public.is_admin()
);

CREATE POLICY "sender_identities_admin_all" ON public.sender_identities FOR ALL USING (auth.uid() = user_id AND public.is_admin());
CREATE POLICY "suppressions_admin_all" ON public.suppressions FOR ALL USING (auth.uid() = user_id AND public.is_admin());

-- Add updated_at triggers
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER sender_identities_updated_at BEFORE UPDATE ON public.sender_identities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Populate profiles for existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM public.users
ON CONFLICT (id) DO NOTHING;

-- Grant admin access to teamsienvi@gmail.com
UPDATE public.profiles SET role = 'admin' WHERE email = 'teamsienvi@gmail.com';

-- Seed default sender identity for Derek
INSERT INTO public.sender_identities (user_id, from_name, from_email, domain, spf_verified, dkim_verified)
SELECT id, 'Derek', 'derek@billionairebrother.com', 'billionairebrother.com', true, true
FROM public.profiles 
WHERE email = 'teamsienvi@gmail.com'
ON CONFLICT DO NOTHING;
