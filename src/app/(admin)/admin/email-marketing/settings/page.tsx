import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import styles from '../email.module.css';

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: identities } = await supabase
    .from('sender_identities')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: suppressions } = await supabase
    .from('suppressions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Manage sender identities and suppressions.</p>
      </div>

      <div className={styles.actionsGrid}>
        
        {/* Sender Identities */}
        <div>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Sender Identities</h2>
            <button className="btn btn-secondary btn-sm">
              Add Domain
            </button>
          </div>
          
          <div className={styles.tableContainer} style={{ marginBottom: 0 }}>
            {identities?.map(id => (
              <div key={id.id} style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{id.from_name} &lt;{id.from_email}&gt;</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>Domain: {id.domain}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <span className={`badge ${id.spf_verified ? 'badge-green' : 'badge-red'}`}>
                      SPF {id.spf_verified ? 'OK' : 'FAIL'}
                    </span>
                    <span className={`badge ${id.dkim_verified ? 'badge-green' : 'badge-red'}`}>
                      DKIM {id.dkim_verified ? 'OK' : 'FAIL'}
                    </span>
                  </div>
                </div>
                {(!id.spf_verified || !id.dkim_verified) && (
                  <div className="disclaimer" style={{ marginTop: 'var(--space-3)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    <span>DNS records require verification. Add the provided TXT records to your domain registrar.</span>
                  </div>
                )}
              </div>
            ))}
            {(!identities || identities.length === 0) && (
              <div className={styles.emptyState}>
                No sender identities configured.
              </div>
            )}
          </div>
        </div>

        {/* Suppressions */}
        <div>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Suppression List</h2>
            <button className="btn btn-secondary btn-sm">
              Manual Add
            </button>
          </div>
          
          <div className={styles.tableContainer} style={{ marginBottom: 0 }}>
            {suppressions?.map(sub => (
              <div key={sub.id} style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{sub.email}</p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>Reason: {sub.reason || 'Unsubscribed'}</p>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }}>Remove</button>
              </div>
            ))}
            {(!suppressions || suppressions.length === 0) && (
              <div className={styles.emptyState}>
                No emails in the suppression list.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
