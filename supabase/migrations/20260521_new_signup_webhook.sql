-- ─── Database Webhook for New Signup ───
-- Date: 2026-05-21
-- Adds a trigger on auth.users to invoke the Next.js API route when a user signs up.

-- We check if the supabase_functions schema and http_request function exist.
-- Standard Supabase projects use supabase_functions.http_request for Database Webhooks.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_functions'
    ) THEN
        -- Drop the trigger if it already exists
        DROP TRIGGER IF EXISTS on_auth_user_created_webhook ON auth.users;

        -- Create the trigger calling supabase_functions.http_request
        CREATE TRIGGER on_auth_user_created_webhook
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION supabase_functions.http_request(
            'https://mybillionairebrother.com/api/webhooks/new-signup',
            'POST',
            '{"Content-Type":"application/json", "x-webhook-secret":"bb_webhook_sec_8f93e2b1c40a59d7"}',
            '{}',
            '5000'
        );
    ELSE
        RAISE NOTICE 'supabase_functions schema not found. Webhook trigger was not created. If this is a local development environment, please make sure Database Webhooks are enabled or apply it in production.';
    END IF;
END $$;
