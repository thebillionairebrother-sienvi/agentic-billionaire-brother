import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from './email.module.css';

export default async function EmailMarketingDashboard() {
  const supabase = await createClient();
  
  // Fetch basic stats
  const { count: campaignsCount } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true });
    
  const { count: pendingCount } = await supabase
    .from('campaign_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
    
  const { count: customersCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  const { count: groupsCount } = await supabase
    .from('customer_groups')
    .select('*', { count: 'exact', head: true });

  // Next 5 upcoming sends
  const { data: upcomingSchedules } = await supabase
    .from('campaign_schedules')
    .select(`
      id,
      scheduled_at,
      email_campaigns ( name ),
      email_templates ( subject )
    `)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(5);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Email Marketing Overview</h1>
        <p className={styles.pageSubtitle}>Manage campaigns, funnels, and customer targeting.</p>
      </div>

      {/* Stats Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3 className={styles.statLabel}>Total Emails Sent</h3>
          <p className={styles.statValue}>0</p>
        </div>
        <div className={styles.statCard}>
          <h3 className={styles.statLabel}>Pending Dispatches</h3>
          <p className={styles.statValue}>{pendingCount || 0}</p>
        </div>
        <div className={styles.statCard}>
          <h3 className={styles.statLabel}>Total Customers</h3>
          <p className={styles.statValue}>{customersCount || 0}</p>
        </div>
        <div className={styles.statCard}>
          <h3 className={styles.statLabel}>Customer Groups</h3>
          <p className={styles.statValue}>{groupsCount || 0}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.actionsGrid}>
        <Link href="/admin/email-marketing/compose/funnel" className={styles.actionCard}>
          <h3 className={styles.actionTitle}>Generate AI Funnel</h3>
          <p className={styles.actionDesc}>Create a 5-email sequence using the Billionaire Brother framework.</p>
          <span className="btn btn-primary btn-sm">Start Funnel Wizard</span>
        </Link>
        
        <Link href="/admin/email-marketing/compose" className={styles.actionCard}>
          <h3 className={styles.actionTitle}>One-Off Campaign</h3>
          <p className={styles.actionDesc}>Send a scheduled broadcast to specific customers or groups.</p>
          <span className="btn btn-secondary btn-sm">Compose Email</span>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Upcoming Scheduled Sends</h2>
          <Link href="/admin/email-marketing/campaigns" className={styles.linkPrimary}>
            View All Campaigns &rarr;
          </Link>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <tbody>
              {upcomingSchedules && upcomingSchedules.length > 0 ? (
                upcomingSchedules.map((schedule) => {
                  const campaign = schedule.email_campaigns as any;
                  const template = schedule.email_templates as any;
                  return (
                    <tr key={schedule.id}>
                      <td>
                        <div className={styles.tableTitle}>{campaign?.name || 'Unnamed Campaign'}</div>
                        <div className="text-secondary text-xs">{template?.subject || 'No Subject'}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-gold">
                          {new Date(schedule.scheduled_at).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={2}>
                    <div className={styles.emptyState}>No upcoming scheduled emails.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
