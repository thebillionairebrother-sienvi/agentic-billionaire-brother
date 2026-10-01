import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const SENDER_CLIENT_ID = '3100c308-48f2-4727-b136-0f4d0f09c94e'; // Billionaire Brother client in Sienvi Sender

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email: rawEmail, country = 'UNKNOWN' } = body;

        const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
        const cleanCountry = typeof country === 'string' ? country.trim().toUpperCase() : 'UNKNOWN';

        if (!email || !EMAIL_REGEX.test(email)) {
            return NextResponse.json(
                { error: 'Please enter a valid email address.' },
                { status: 400 }
            );
        }

        let localLeadId: string | null = null;

        // 1. Record lead locally in main web platform Supabase
        try {
            const adminSupabase = await createServiceClient();
            const { data: insertedLead, error: insertError } = await adminSupabase
                .from('lead_subscriptions')
                .insert([
                    {
                        email,
                        consent_given: true,
                        source: 'region_restricted_waitlist',
                        variant: cleanCountry,
                        device_type: 'web',
                        trigger_type: 'geo_fence_waitlist',
                        page_path: '/region-restricted',
                        status: 'waitlist',
                    },
                ])
                .select('id')
                .single();

            if (!insertError && insertedLead) {
                localLeadId = insertedLead.id;
            } else if (insertError) {
                console.warn('[waitlist] Local DB insert notice:', insertError.message);
            }
        } catch (dbErr: unknown) {
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            console.warn('[waitlist] Local DB connection warning:', msg);
        }

        // 2. Direct Sync into Sienvi Sender (MailPilot) recipients table if configured
        const emailerUrl = process.env.EMAILER_SUPABASE_URL;
        const emailerKey = process.env.EMAILER_SUPABASE_SERVICE_ROLE_KEY || process.env.EMAILER_SUPABASE_ANON_KEY;

        if (emailerUrl && emailerKey) {
            try {
                const senderSupabase = createSupabaseClient(emailerUrl, emailerKey);

                const { data: existingRecipients } = await senderSupabase
                    .from('recipients')
                    .select('id, segment')
                    .eq('client_id', SENDER_CLIENT_ID)
                    .eq('email', email);

                const metadata = {
                    source: 'region_restricted_waitlist',
                    country: cleanCountry,
                    lead_type: 'international_expansion_waitlist',
                    subscribed_at: new Date().toISOString(),
                };

                if (!existingRecipients || existingRecipients.length === 0) {
                    await senderSupabase.from('recipients').insert([
                        {
                            client_id: SENDER_CLIENT_ID,
                            email,
                            name: '',
                            tags: ['waitlist', `geo_${cleanCountry.toLowerCase()}`],
                            status: 'subscribed',
                            metadata,
                        },
                    ]);
                }
            } catch (senderErr) {
                console.warn('[waitlist] Sienvi Sender sync warning:', senderErr);
            }
        }

        return NextResponse.json({
            success: true,
            leadId: localLeadId,
            message: 'You have been added to the priority international expansion list.',
        });
    } catch (err) {
        console.error('[waitlist] Error processing signup:', err);
        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again.' },
            { status: 500 }
        );
    }
}
