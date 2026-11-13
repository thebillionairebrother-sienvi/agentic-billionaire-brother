/**
 * Renders the 7-day pre-charge reminder email to HTML for review.
 * Run: npx tsx scratch/render-reminder-email.ts <out.html>
 */
import fs from 'node:fs';
import { buildTrialReminderEmail } from '../src/lib/billing/reminder-email';

const email = buildTrialReminderEmail({
    name: 'Alex',
    firstChargeAt: new Date('2026-12-31T07:00:00.000Z'), // Dec 30, 11:00 p.m. PST
    priceCents: 4900,
    currency: 'usd',
    interval: 'month',
    cancelUrl: 'https://thebillionairebrother.com/trial/cancel?token=EXAMPLE',
    manageUrl: 'https://thebillionairebrother.com/settings',
});

const out = process.argv[2] || 'reminder-email.html';
fs.writeFileSync(out, email.html);
console.log('Subject:', email.subject);
console.log('--- text version ---\n' + email.text);
