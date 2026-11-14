-- =============================================
-- Guest chat limits (server-side counters for /api/chat/public)
-- =============================================
-- Rows: bucket = 'ip:<hmac of client ip>' or 'global', one per UTC day.
-- Only the service role touches this table (RLS on, no policies).

CREATE TABLE IF NOT EXISTS public.guest_chat_usage (
  bucket TEXT NOT NULL,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, day)
);

ALTER TABLE public.guest_chat_usage ENABLE ROW LEVEL SECURITY;

-- Atomically counts one guest message and returns the new per-IP and global totals.
CREATE OR REPLACE FUNCTION public.increment_guest_chat(p_ip_bucket TEXT, p_day DATE)
RETURNS TABLE (ip_count INTEGER, global_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.guest_chat_usage (bucket, day, count)
  VALUES (p_ip_bucket, p_day, 1)
  ON CONFLICT (bucket, day) DO UPDATE SET count = public.guest_chat_usage.count + 1
  RETURNING public.guest_chat_usage.count INTO ip_count;

  INSERT INTO public.guest_chat_usage (bucket, day, count)
  VALUES ('global', p_day, 1)
  ON CONFLICT (bucket, day) DO UPDATE SET count = public.guest_chat_usage.count + 1
  RETURNING public.guest_chat_usage.count INTO global_count;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_guest_chat(TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_guest_chat(TEXT, DATE) TO service_role;

-- Old rows are not needed after a few days
CREATE INDEX IF NOT EXISTS idx_guest_chat_usage_day ON public.guest_chat_usage (day);
