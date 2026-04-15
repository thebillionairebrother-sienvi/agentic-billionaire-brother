import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin';

export const revalidate = 0;

// Shape returned per matching campaign
export interface CampaignKpi {
    campaign_id: string;
    campaign_name: string;
    campaign_status: string;
    campaign_created_at: string;
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    open_rate: number;      // percentage, e.g. 24.5
    click_rate: number;     // percentage, e.g. 8.1
    total_sequences: number;
    dispatched_sequences: number;
}

export interface EmailKpisResponse {
    success: boolean;
    campaigns: CampaignKpi[];
    totals: {
        totalSent: number;
        avgOpenRate: number;
        avgClickRate: number;
    };
    error?: string;
}

export async function GET(request: Request) {
    try {
        // 1. Verify the caller is an authenticated BB admin
        const { user } = await createMobileAwareClient(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Security: Only platform admins may access cross-service email analytics
        if (!isAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Create a read-only client pointing at the Sienvi emailer Supabase project
        const emailerUrl = process.env.EMAILER_SUPABASE_URL;
        const emailerKey = process.env.EMAILER_SUPABASE_ANON_KEY;

        if (!emailerUrl || !emailerKey) {
            return NextResponse.json(
                { error: 'Emailer Supabase credentials not configured. Add EMAILER_SUPABASE_URL and EMAILER_SUPABASE_ANON_KEY to .env.local.' },
                { status: 500 }
            );
        }

        const emailerSupabase = createClient(emailerUrl, emailerKey, {
            auth: { persistSession: false },
        });

        // 3. Call the SECURITY DEFINER RPC function to get per-campaign KPIs
        //    The function filters campaigns by name ILIKE '%Billionaire Brother%'
        const { data, error } = await emailerSupabase
            .rpc('get_bb_campaign_kpis', {
                campaign_name_pattern: '%Billionaire Brother%',
            });

        if (error) {
            console.error('[email-kpis] RPC error:', error);
            return NextResponse.json(
                { error: `Failed to fetch campaign KPIs: ${error.message}` },
                { status: 500 }
            );
        }

        const campaigns: CampaignKpi[] = (data ?? []).map((row: any) => ({
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            campaign_status: row.campaign_status,
            campaign_created_at: row.campaign_created_at,
            total_sent: Number(row.total_sent ?? 0),
            total_opened: Number(row.total_opened ?? 0),
            total_clicked: Number(row.total_clicked ?? 0),
            open_rate: Number(row.open_rate ?? 0),
            click_rate: Number(row.click_rate ?? 0),
            total_sequences: Number(row.total_sequences ?? 0),
            dispatched_sequences: Number(row.dispatched_sequences ?? 0),
        }));

        // 4. Build aggregate totals across all matched campaigns
        const totalSent = campaigns.reduce((s, c) => s + c.total_sent, 0);
        const avgOpenRate = campaigns.length > 0
            ? Number((campaigns.reduce((s, c) => s + c.open_rate, 0) / campaigns.length).toFixed(1))
            : 0;
        const avgClickRate = campaigns.length > 0
            ? Number((campaigns.reduce((s, c) => s + c.click_rate, 0) / campaigns.length).toFixed(1))
            : 0;

        return NextResponse.json({
            success: true,
            campaigns,
            totals: { totalSent, avgOpenRate, avgClickRate },
        } satisfies EmailKpisResponse);

    } catch (err) {
        console.error('[email-kpis] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch email analytics' },
            { status: 500 }
        );
    }
}
