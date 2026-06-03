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

        // 3. Query all clients to find the fuzzy match for "Billionaire Brother"
        const { data: clients, error: clientsErr } = await emailerSupabase
            .from('clients')
            .select('id, name');

        if (clientsErr) {
            console.error('[email-kpis] Client lookup error:', clientsErr);
            return NextResponse.json(
                { error: `Failed to retrieve clients: ${clientsErr.message}` },
                { status: 500 }
            );
        }

        const normalizeClientName = (name: string): string => {
            if (!name) return '';
            return name
                .toLowerCase()
                .replace(/^the\s+/, '')
                .replace(/\b(agency|brand|llc|inc|co|corp|group)\b/g, '')
                .replace(/[^a-z0-9]/g, '')
                .trim();
        };

        const targetClientName = 'billionairebrother';
        const matchedClient = clients?.find(c => normalizeClientName(c.name) === targetClientName);

        if (!matchedClient) {
            return NextResponse.json({
                success: true,
                campaigns: [],
                totals: { totalSent: 0, avgOpenRate: 0, avgClickRate: 0 }
            } satisfies EmailKpisResponse);
        }

        // 4. Query campaigns for the matched client
        const { data: campaignsData, error: campaignsErr } = await emailerSupabase
            .from('campaigns')
            .select('id, title, status, type, sent_date, open_rate, click_rate, created_at, sequence_data')
            .eq('client_id', matchedClient.id)
            .order('created_at', { ascending: false });

        if (campaignsErr) {
            console.error('[email-kpis] Campaigns query error:', campaignsErr);
            return NextResponse.json(
                { error: `Failed to query campaigns: ${campaignsErr.message}` },
                { status: 500 }
            );
        }

        if (!campaignsData || campaignsData.length === 0) {
            return NextResponse.json({
                success: true,
                campaigns: [],
                totals: { totalSent: 0, avgOpenRate: 0, avgClickRate: 0 }
            } satisfies EmailKpisResponse);
        }

        const campaignIds = campaignsData.map(c => c.id);

        // 5. Query email tracking data to aggregate events
        const { data: trackingRecords, error: trackingErr } = await emailerSupabase
            .from('email_tracking')
            .select('campaign_id, status')
            .in('campaign_id', campaignIds);

        if (trackingErr) {
            console.error('[email-kpis] Email tracking query error:', trackingErr);
            return NextResponse.json(
                { error: `Failed to query email tracking data: ${trackingErr.message}` },
                { status: 500 }
            );
        }

        const trackingByCampaign: Record<string, {
            queued: number;
            delivered: number;
            opened: number;
            clicked: number;
            bounced: number;
            total: number;
        }> = {};

        campaignIds.forEach(id => {
            trackingByCampaign[id] = { queued: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, total: 0 };
        });

        trackingRecords?.forEach(record => {
            const camp = trackingByCampaign[record.campaign_id];
            if (!camp) return;

            camp.total++;
            const status = record.status?.toLowerCase();
            if (status === 'queued') {
                camp.queued++;
            } else if (status === 'bounced' || status === 'complained') {
                camp.bounced++;
            } else if (status === 'delivered') {
                camp.delivered++;
            } else if (status === 'opened') {
                camp.opened++;
            } else if (status === 'clicked') {
                camp.clicked++;
            }
        });

        interface SienviCampaign {
            id: string;
            title: string;
            status: string;
            type: string;
            sent_date: string | null;
            open_rate: number | null;
            click_rate: number | null;
            created_at: string;
            sequence_data: {
                schedules?: string[];
            } | null;
        }

        // 6. Map to frontend CampaignKpi objects
        const campaigns: CampaignKpi[] = (campaignsData as unknown as SienviCampaign[]).map((c) => {
            const stats = trackingByCampaign[c.id] || { queued: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, total: 0 };
            const deliveredCount = stats.delivered + stats.opened + stats.clicked;
            const openedCount = stats.opened + stats.clicked;
            const clickedCount = stats.clicked;
            const sentCount = stats.total;

            let openRate = c.open_rate || 0;
            let clickRate = c.click_rate || 0;
            if (sentCount > 0) {
                openRate = deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0;
                clickRate = deliveredCount > 0 ? (clickedCount / deliveredCount) * 100 : 0;
            }

            let total_sequences = 0;
            let dispatched_sequences = 0;
            if (c.sequence_data && Array.isArray(c.sequence_data.schedules)) {
                total_sequences = c.sequence_data.schedules.length;
                const now = new Date();
                dispatched_sequences = c.sequence_data.schedules.filter((s: string) => s && new Date(s) <= now).length;
            }

            let dynamicStatus = c.status;
            if (c.sequence_data && Array.isArray(c.sequence_data.schedules)) {
                const now = new Date();
                const pastCount = dispatched_sequences;
                const totalCount = total_sequences;

                if (c.status === 'Scheduled' && pastCount === totalCount && totalCount > 0) {
                    dynamicStatus = 'completed';
                } else if (c.status === 'Scheduled' && pastCount > 0) {
                    dynamicStatus = 'sending';
                }
            }

            return {
                campaign_id: c.id,
                campaign_name: c.title,
                campaign_status: (dynamicStatus ?? 'draft').toLowerCase(),
                campaign_created_at: c.created_at || c.sent_date || new Date().toISOString(),
                total_sent: sentCount,
                total_opened: openedCount,
                total_clicked: clickedCount,
                open_rate: parseFloat(Number(openRate).toFixed(1)),
                click_rate: parseFloat(Number(clickRate).toFixed(1)),
                total_sequences,
                dispatched_sequences
            };
        });

        // 7. Build aggregate totals across all matched campaigns
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
