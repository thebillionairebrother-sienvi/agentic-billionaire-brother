/**
 * Seven-day pre-charge reminder email (BB-branded, transactional).
 */
import { formatMoney, formatPst } from './config';

export interface ReminderEmailInput {
    name?: string | null;
    firstChargeAt: Date;
    priceCents: number;
    currency: string;
    interval: string;
    cancelUrl: string;
    manageUrl: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildTrialReminderEmail(input: ReminderEmailInput) {
    const price = formatMoney(input.priceCents, input.currency);
    const date = formatPst(input.firstChargeAt);
    const every = input.interval === 'year' ? 'every year' : 'every month';
    const hi = input.name ? `Hey ${esc(input.name)},` : 'Hey,';

    const subject = `Your free month ends ${formatPst(input.firstChargeAt, { withTime: false })}: ${price} charge in 7 days`;

    const text = [
        hi,
        '',
        `Your free month of the Billionaire Brother Plan ends on ${date}.`,
        `Unless you cancel before then, your card will be charged ${price} on that date and ${every} after that.`,
        '',
        `Plan: Brother Plan`,
        `First charge: ${price} on ${date}`,
        `Billing: ${price} ${every} until you cancel`,
        '',
        `Want to keep going? You don't need to do anything.`,
        `Don't want to be charged? Cancel in one click: ${input.cancelUrl}`,
        `You'll keep full access until ${date}, then move to the free plan. You won't be charged.`,
        '',
        `Manage billing: ${input.manageUrl}`,
        '',
        '— Derek, your Billionaire Brother',
    ].join('\n');

    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#e8e6e1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#14141c;border:1px solid #2a2a35;border-radius:14px;">
<tr><td style="padding:28px 28px 8px;">
  <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#d4a72c;font-weight:700;">Billionaire Brother</div>
  <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">Your free month ends in 7 days</h1>
</td></tr>
<tr><td style="padding:12px 28px 4px;font-size:15px;line-height:1.6;color:#c9c6bf;">
  <p style="margin:0 0 12px;">${hi}</p>
  <p style="margin:0 0 16px;">Unless you cancel before <strong style="color:#fff;">${esc(date)}</strong>, your card will be charged <strong style="color:#fff;">${esc(price)}</strong> on that date and ${every} after that.</p>
</td></tr>
<tr><td style="padding:0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2a35;border-radius:10px;font-size:14px;">
    <tr><td style="padding:10px 14px;color:#8f8c85;">Plan</td><td style="padding:10px 14px;text-align:right;color:#fff;">Brother Plan</td></tr>
    <tr><td style="padding:10px 14px;color:#8f8c85;border-top:1px solid #2a2a35;">First charge</td><td style="padding:10px 14px;text-align:right;color:#fff;border-top:1px solid #2a2a35;">${esc(price)} on ${esc(date)}</td></tr>
    <tr><td style="padding:10px 14px;color:#8f8c85;border-top:1px solid #2a2a35;">Then</td><td style="padding:10px 14px;text-align:right;color:#fff;border-top:1px solid #2a2a35;">${esc(price)} ${every} until you cancel</td></tr>
  </table>
</td></tr>
<tr><td style="padding:20px 28px 4px;font-size:15px;line-height:1.6;color:#c9c6bf;">
  <p style="margin:0 0 6px;"><strong style="color:#fff;">Keeping it?</strong> You don't need to do anything.</p>
  <p style="margin:0 0 16px;"><strong style="color:#fff;">Not for you?</strong> Cancel now and you won't be charged. You keep full access until ${esc(date)}, then move to the free plan.</p>
  <a href="${esc(input.cancelUrl)}" style="display:inline-block;background:#d4a72c;color:#14141c;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Cancel my trial</a>
  <p style="margin:16px 0 0;font-size:13px;"><a href="${esc(input.manageUrl)}" style="color:#d4a72c;">Manage billing</a></p>
</td></tr>
<tr><td style="padding:20px 28px 28px;font-size:12px;color:#6f6c66;line-height:1.5;">
  You're receiving this because you started a free trial that renews automatically. This is a required billing notice.
</td></tr>
</table></td></tr></table></body></html>`;

    return { subject, html, text };
}
