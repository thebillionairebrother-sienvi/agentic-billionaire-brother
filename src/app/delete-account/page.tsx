import { PolicyLayout } from '@/components/PolicyLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Deletion Guide | The Billionaire Brother',
  description: 'Learn how to delete your Billionaire Brother account, cancel active Stripe billing subscriptions, and permanently purge strategic business parameters.',
  alternates: {
    canonical: '/delete-account',
  },
};


export default function AccountDeletion() {
  return (
    <PolicyLayout title="Account Deletion Guide" subtitle="Last Updated: June 9, 2026">
      <p>
        We believe in full user control. If you decide to stop using <strong>The Billionaire Brother</strong>, 
        you can delete your account and request the complete purging of all your strategic data at any time.
      </p>

      <h2>1. The Deletion Process</h2>
      <p>
        To permanently delete your account, follow either of these methods:
      </p>

      <h3>Method A: Self-Service Deletion (Recommended)</h3>
      <ol>
        <li>Log into your <strong>Billionaire Brother Terminal</strong>.</li>
        <li>Navigate to <strong>Settings</strong> from the dashboard sidebar.</li>
        <li>Scroll down to the bottom of the <strong>Profile</strong> tab.</li>
        <li>Under the "Danger Zone" header, click the <strong>Delete Account</strong> button.</li>
        <li>Confirm the action by typing your account email address.</li>
      </ol>
      <p>
        Once confirmed, your account will be immediately deactivated, and your active session will be terminated.
      </p>

      <h3>Method B: Manual Deletion Request</h3>
      <p>
        If you are unable to access your dashboard, you can request manual erasure:
      </p>
      <ol>
        <li>Go to our <Link href="/contact" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>Contact Strategist</Link> form.</li>
        <li>Select the category <strong>"Account & Deletion Request"</strong>.</li>
        <li>Enter your registered account email.</li>
        <li>Request that your account and business strategy database be wiped.</li>
      </ol>
      <p>
        Our support team will process manual deletion requests within 3 business days and send a final confirmation email once complete.
      </p>

      <h2>2. What Data is Purged?</h2>
      <p>
        When your account is deleted, we execute a hard delete of your records. The following information is completely and permanently erased from our databases:
      </p>
      <ul>
        <li>Your email address, hashed password, and account profile details.</li>
        <li>All active and archived Questionnaire answers.</li>
        <li>Your strategy history logs, active KPIs, and metrics.</li>
        <li>All checkmarks, notes, and tasks in your active and historical Ship Packs.</li>
        <li>All historical chat logs and transcripts with Derek.</li>
      </ul>

      <h2>3. Stripe Billing & Subscription Purge</h2>
      <p>
        Upon account deletion, any active paid subscription will be immediately cancelled in Stripe to ensure you are never billed again. 
        Your Stripe billing customer record and payment invoice history are retained for accounting and tax reporting compliance as required by local laws.
      </p>

      <h2>4. Data Deletion Timeline</h2>
      <p>
        Database deletion is executed immediately upon confirmation. However, backups of our databases may retain encrypted snapshots for up to 30 days. Backup files are overwritten automatically and are never accessed unless required for security recovery.
      </p>

      <h2>5. Reversing Deletion</h2>
      <p>
        <strong>WARNING:</strong> Account deletion is irreversible. We do not store archiving records. Once your account is deleted, our support team cannot recover your strategy checklists, dashboard scores, or chat logs. If you return in the future, you must start from the initial questionnaire.
      </p>
    </PolicyLayout>
  );
}
