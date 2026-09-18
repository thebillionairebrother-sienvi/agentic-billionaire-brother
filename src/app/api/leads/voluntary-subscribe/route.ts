import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || 'https://chromewebstore.google.com/detail/billionaire-brother-execu/ofaehbeohogfjnfbfjpnceihhnegamnh';
const SENDER_CLIENT_ID = '3100c308-48f2-4727-b136-0f4d0f09c94e'; // Billionaire Brother client in Sienvi Sender
const WARM_SEGMENT_NAME = 'Warm Voluntary Leads - Derek for Chrome';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            email: rawEmail,
            variant = 'A',
            trigger_type = 'unknown',
            device_type = 'desktop',
            page_path = '/',
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            utm_term,
        } = body;

        const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

        if (!email || !EMAIL_REGEX.test(email)) {
            return NextResponse.json(
                { error: 'Please enter a valid email address.' },
                { status: 400 }
            );
        }

        let localLeadId: string | null = null;
        let syncedToSender = false;
        let senderRecipientId: string | null = null;

        // 1. Record lead locally in main web platform Supabase
        try {
            const adminSupabase = await createServiceClient();
            const { data: insertedLead, error: insertError } = await adminSupabase
                .from('lead_subscriptions')
                .insert([
                    {
                        email,
                        consent_given: true,
                        source: 'derek_for_chrome_popup',
                        variant,
                        device_type,
                        trigger_type,
                        page_path,
                        utm_source: utm_source || null,
                        utm_medium: utm_medium || null,
                        utm_campaign: utm_campaign || null,
                        utm_content: utm_content || null,
                        utm_term: utm_term || null,
                        status: 'active',
                    }
                ])
                .select('id')
                .single();

            if (!insertError && insertedLead) {
                localLeadId = insertedLead.id;
            } else if (insertError) {
                console.warn('[voluntary-subscribe] Local DB insert notice:', insertError.message);
            }
        } catch (dbErr: unknown) {
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            console.warn('[voluntary-subscribe] Local DB connection warning:', msg);
        }

        // 2. Direct Sync into Sienvi Sender (MailPilot) recipients table
        const emailerUrl = process.env.EMAILER_SUPABASE_URL;
        const emailerKey = process.env.EMAILER_SUPABASE_ANON_KEY;

        if (emailerUrl && emailerKey) {
            try {
                const senderSupabase = createSupabaseClient(emailerUrl, emailerKey);

                // Check if recipient already exists for this client and email
                const { data: existingRecipients } = await senderSupabase
                    .from('recipients')
                    .select('id, segment')
                    .eq('client_id', SENDER_CLIENT_ID)
                    .eq('email', email);

                const metadata = {
                    source: 'derek_for_chrome_popup',
                    variant,
                    device_type,
                    trigger_type,
                    page_path,
                    utm_source,
                    utm_campaign,
                    lead_type: 'warm_voluntary_subscription',
                    subscribed_at: new Date().toISOString()
                };

                if (existingRecipients && existingRecipients.length > 0) {
                    const existing = existingRecipients[0];
                    senderRecipientId = existing.id;
                    // Append segment if not present or keep warm segment prominent
                    const existingSegment = existing.segment || '';
                    const updatedSegment = existingSegment.includes(WARM_SEGMENT_NAME)
                        ? existingSegment
                        : `${WARM_SEGMENT_NAME}, ${existingSegment}`.trim().replace(/^,|,$/g, '');

                    await senderSupabase
                        .from('recipients')
                        .update({
                            status: 'Active',
                            segment: updatedSegment,
                            lead_metadata: metadata,
                        })
                        .eq('id', existing.id);

                    syncedToSender = true;
                } else {
                    const { data: newRecipient, error: senderInsertError } = await senderSupabase
                        .from('recipients')
                        .insert([
                            {
                                client_id: SENDER_CLIENT_ID,
                                name: 'Founder',
                                email,
                                segment: WARM_SEGMENT_NAME,
                                status: 'Active',
                                lead_metadata: metadata,
                                channel_eligibility: 'Inbound_Warm'
                            }
                        ])
                        .select('id')
                        .single();

                    if (!senderInsertError && newRecipient) {
                        senderRecipientId = newRecipient.id;
                        syncedToSender = true;
                    } else if (senderInsertError) {
                        console.error('[voluntary-subscribe] Sender insert error:', senderInsertError);
                    }
                }

                // Update local record with sender sync state if we have a localLeadId
                if (localLeadId && syncedToSender) {
                    const adminSupabase = await createServiceClient();
                    await adminSupabase
                        .from('lead_subscriptions')
                        .update({
                            synced_to_sender: true,
                            sender_recipient_id: senderRecipientId,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', localLeadId);
                }
            } catch (senderErr: unknown) {
                const msg = senderErr instanceof Error ? senderErr.message : String(senderErr);
                console.error('[voluntary-subscribe] Sender sync exception:', msg);
            }
        }

        return NextResponse.json({
            success: true,
            storeUrl: CHROME_STORE_URL,
            syncedToSender,
            message: 'Voluntary subscription confirmed.',
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[voluntary-subscribe] Unexpected error:', msg);
        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again or visit the Chrome Web Store directly.' },
            { status: 500 }
        );
    }
}
