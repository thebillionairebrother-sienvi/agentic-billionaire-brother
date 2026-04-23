import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import Link from 'next/link';
import styles from '../email.module.css';

export default async function CampaignsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select(`
      *,
      email_templates (id),
      campaign_schedules (id, scheduled_at, dispatched)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  const getStatusBadge = (dbStatus: string, schedules: any[]) => {
    if (dbStatus === 'draft') return <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>Draft</span>;
    if (!schedules || schedules.length === 0) return <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{dbStatus}</span>;

    const now = new Date();
    const allDispatched = schedules.every((s) => s.dispatched);
    const someDispatched = schedules.some((s) => s.dispatched);
    const allPastSchedule = schedules.every((s) => new Date(s.scheduled_at) <= now);

    if (allDispatched) return <span className="badge badge-green">Completed</span>;
    if (allPastSchedule && !allDispatched && someDispatched) return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>Sending</span>;
    if (dbStatus === 'active') return <span className="badge badge-blue">Active</span>;
    
    return <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{dbStatus}</span>;
  };

  return (
    <div>
      <div className={styles.sectionHeader} style={{ marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 className={styles.pageTitle}>Campaigns</h1>
          <p className={styles.pageSubtitle}>Manage your email sequences and one-off broadcasts.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/admin/email-marketing/compose/funnel" className="btn btn-secondary">
            New AI Funnel
          </Link>
          <Link href="/admin/email-marketing/compose" className="btn btn-primary">
            New Email
          </Link>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Status</th>
              <th>Type</th>
              <th>Emails</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns?.map(campaign => (
              <tr key={campaign.id}>
                <td><div className={styles.tableTitle}>{campaign.name}</div></td>
                <td>
                  {getStatusBadge(campaign.status, campaign.campaign_schedules || [])}
                </td>
                <td style={{ textTransform: 'capitalize' }}>{campaign.campaign_type}</td>
                <td>
                  {campaign.email_templates?.length || 0} template{(campaign.email_templates?.length || 0) !== 1 ? 's' : ''}
                </td>
                <td>
                  <div className={styles.tableActions}>
                    {campaign.status === 'draft' && (
                      <Link href={`/admin/email-marketing/campaigns/${campaign.id}/setup`} className={styles.linkPrimary}>
                        Setup Schedule
                      </Link>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ padding: 0 }}>View</button>
                  </div>
                </td>
              </tr>
            ))}
            {(!campaigns || campaigns.length === 0) && (
              <tr>
                <td colSpan={5}>
                  <div className={styles.emptyState}>
                    No campaigns found. Create one to get started.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
