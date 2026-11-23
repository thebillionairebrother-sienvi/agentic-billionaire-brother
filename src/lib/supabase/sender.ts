import { createClient } from '@supabase/supabase-js';

/**
 * Server-only client for the Sienvi Sender database. Uses the service role key, which bypasses row-level
 * security, so callers must limit every query to the Billionaire Brother client.
 * Returns null when the key or URL is not configured.
 */
export function createSenderClient() {
    const url = process.env.EMAILER_SUPABASE_URL;
    const serviceKey = process.env.EMAILER_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;

    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
