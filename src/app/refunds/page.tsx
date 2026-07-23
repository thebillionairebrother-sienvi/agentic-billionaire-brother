import { PolicyLayout } from '@/components/PolicyLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy | The Billionaire Brother',
  description: 'Understand the 14-day risk-free money-back guarantee and cancellation policies for The Billionaire Brother subscription plans.',
  alternates: {
    canonical: '/refunds',
  },
};


export default function RefundPolicy() {
  return (
    <PolicyLayout title="Refund & Cancellation Policy" subtitle="Last Updated: June 9, 2026">
      <h2>1. The 14-Day Risk-Free Guarantee</h2>
      <p>
        We are confident in Derek's capability to help you ship. If you subscribe to any of our paid tiers (the <strong>Brother Plan</strong> or <strong>Team Plan</strong>) and find that the strategic guidance does not provide value, you are entitled to a full refund within <strong>14 calendar days</strong> of your initial purchase.
      </p>
      <p>
        This guarantee applies to your first billing cycle only. Subsequent renewals or upgrades are not eligible for refunds under this policy.
      </p>

      <h2>2. How to Request a Refund</h2>
      <p>
        To request a refund within the 14-day window, please submit a request through our <Link href="/contact" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>Contact Strategist</Link> portal. When submitting your request, please ensure:
      </p>
      <ul>
        <li>You use the email address associated with your active Billionaire Brother account.</li>
        <li>You state "Refund Request" in the subject line or category.</li>
        <li>(Optional) You share brief feedback on where the strategy fell short. Derek appreciates direct, unvarnished feedback.</li>
      </ul>
      <p>
        Once approved, your refund will be processed immediately. It may take 5 to 10 business days for the funds to reflect on your card, depending on your bank.
      </p>

      <h2>3. Subscription Cancellation Policy</h2>
      <p>
        You can cancel your subscription at any time. We believe in absolute transparency — there are no hidden retention questionnaires, phone calls, or hurdles.
      </p>
      <ul>
        <li><strong>Self-Service:</strong> Go to your <strong>Settings</strong> dashboard under <strong>Billing</strong>, and click "Cancel Subscription".</li>
        <li><strong>Access Retention:</strong> Upon cancellation, your account will remain active at your current tier until the end of your prepaid billing period. At that date, your account will downgrade to the Free tier, and you will not be billed again.</li>
        <li><strong>No Re-activation Fees:</strong> If you choose to re-deploy your account at a later date, you can upgrade again at the then-current pricing.</li>
      </ul>

      <h2>4. Post-Guarantee Billing & Pro-rating</h2>
      <p>
        After the 14-day risk-free window has closed, we do not offer pro-rated refunds or credit for partial months of service. 
      </p>
      <p>
        If you cancel mid-month, you will retain access to your AI credits and strategy history until your renewal date, but no refunds will be issued for the remaining days of that cycle.
      </p>

      <h2>5. Chargebacks</h2>
      <p>
        We encourage you to contact us directly if you experience any billing discrepancies, double charges, or subscription issues. Initiating a bank chargeback without contacting us first will lead to immediate, permanent account suspension and purging of all strategy logs.
      </p>

      <h2>6. Contact Billing Support</h2>
      <p>
        For any billing questions, transaction history requests, or invoice adjustments, please transmit your inquiry through the <Link href="/contact" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>Contact Strategist</Link> page.
      </p>
    </PolicyLayout>
  );
}
