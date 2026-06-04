import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const NOTIFY_EMAIL = 'tech@sienvi.com';
const FROM_EMAIL = 'noreply@mybillionairebrother.com';
const WEBHOOK_SECRET = process.env.SIGNUP_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/new-signup
 *
 * Called by a Supabase Database webhook on INSERT to auth.users.
 * Sends an internal notification email to the admin address.
 *
 * Supabase webhook payload shape (auth.users INSERT):
 * {
 *   type: "INSERT",
 *   table: "users",
 *   schema: "auth",
 *   record: { id, email, raw_user_meta_data, created_at, ... },
 *   old_record: null
 * }
 */
export async function POST(req: NextRequest) {
    // ── Verify shared secret (set as a custom header in the Supabase webhook) ──
    if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'REPLACE_WITH_A_STRONG_RANDOM_SECRET') {
        console.error('[new-signup webhook] SIGNUP_WEBHOOK_SECRET is not configured or is using placeholder');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const incomingSecret = req.headers.get('x-webhook-secret');
    if (incomingSecret !== WEBHOOK_SECRET) {
        console.warn('[new-signup webhook] Unauthorized — wrong or missing secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Guard: only handle INSERT events on the users table
    if (payload.type !== 'INSERT') {
        return NextResponse.json({ skipped: true, reason: 'Not an INSERT event' });
    }

    const record = payload.record as Record<string, unknown> | undefined;
    if (!record) {
        return NextResponse.json({ error: 'No record in payload' }, { status: 400 });
    }

    const email = (record.email as string) ?? 'unknown';
    const userId = (record.id as string) ?? 'unknown';
    const createdAt = (record.created_at as string) ?? new Date().toISOString();
    const meta = (record.raw_user_meta_data as Record<string, unknown>) ?? {};
    const displayName = (meta.display_name as string) ?? '—';
    const tier = (meta.tier as string) ?? 'free';
    const promoCode = (meta.promo_code as string) ?? '—';

    const formattedDate = new Date(createdAt).toLocaleString('en-AU', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
        timeStyle: 'short',
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: 'Courier New', Courier, monospace; color: #e5e5e5; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #131313; border: 2px solid #FFD700; border-radius: 4px; overflow: hidden; }
    .header { background: #FFD700; padding: 20px 28px; }
    .header h1 { margin: 0; color: #000; font-size: 18px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
    .header p { margin: 4px 0 0; color: #333; font-size: 12px; letter-spacing: 0.08em; }
    .body { padding: 28px; }
    .label { font-size: 10px; letter-spacing: 0.15em; color: #FFD700; text-transform: uppercase; margin-bottom: 4px; }
    .value { font-size: 15px; color: #f5f5f5; margin-bottom: 20px; padding: 10px 14px; background: #1e1e1e; border-left: 3px solid #FFD700; border-radius: 2px; word-break: break-all; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .badge-free { background: #2a2a2a; color: #888; border: 1px solid #444; }
    .badge-brother { background: rgba(255,215,0,0.15); color: #FFD700; border: 1px solid rgba(255,215,0,0.4); }
    .badge-team { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.4); }
    .footer { padding: 16px 28px; border-top: 1px solid #2a2a2a; font-size: 11px; color: #555; letter-spacing: 0.06em; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>👑 New Signup Alert</h1>
      <p>THE BILLIONAIRE BROTHER // DEREK SYSTEM</p>
    </div>
    <div class="body">
      <div class="label">New User Email</div>
      <div class="value">${email}</div>

      <div class="label">Display Name</div>
      <div class="value">${displayName}</div>

      <div class="label">Tier</div>
      <div class="value">
        <span class="badge badge-${tier}">${tier.toUpperCase()}</span>
      </div>

      <div class="label">Promo Code Used</div>
      <div class="value">${promoCode}</div>

      <div class="label">Signed Up</div>
      <div class="value">${formattedDate} (Philippines Time)</div>

      <div class="label">User ID</div>
      <div class="value" style="font-size:12px; color:#888;">${userId}</div>
    </div>
    <div class="footer">
      This is an automated alert from The Billionaire Brother system. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;

    try {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.error('[new-signup webhook] RESEND_API_KEY is not configured');
            return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
        }
        const resend = new Resend(resendApiKey);

        let sendResult = await resend.emails.send({
            from: `The Billionaire Brother <${FROM_EMAIL}>`,
            to: [NOTIFY_EMAIL],
            subject: `👑 New Signup: ${email} [${tier.toUpperCase()}]`,
            html: htmlBody,
        });

        // Smart Fallback for unverified domains / sandbox mode
        if (sendResult.error && (sendResult.error as any).statusCode === 403) {
            console.warn(
                `[new-signup webhook] Main send failed (domain unverified). Falling back to Resend Sandbox mode.`
            );
            sendResult = await resend.emails.send({
                from: 'The Billionaire Brother Sandbox <onboarding@resend.dev>',
                to: ['teamsienvi@gmail.com'],
                subject: `👑 [Sandbox] New Signup: ${email} [${tier.toUpperCase()}]`,
                html: htmlBody + '<p style="color:#FFD700; font-size:12px; margin-top:20px;">⚠️ Note: This email was sent using Resend Sandbox fallback because the domain <strong>mybillionairebrother.com</strong> is not verified.</p>',
            });
        }

        if (sendResult.error) {
            console.error('[new-signup webhook] Resend error:', sendResult.error);
            return NextResponse.json({ error: 'Email send failed', details: sendResult.error }, { status: 500 });
        }

        console.log(`[new-signup webhook] Notification sent for ${email}, resend id: ${sendResult.data?.id}`);
        return NextResponse.json({ success: true, emailId: sendResult.data?.id });
    } catch (err) {
        console.error('[new-signup webhook] Unexpected error:', err);
        return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
    }
}
