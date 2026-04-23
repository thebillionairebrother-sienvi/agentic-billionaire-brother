import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import styles from '../email.module.css';

export default async function CustomersPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Fetch customers
  const { data: customers } = await supabase
    .from('customers')
    .select('*, customer_group_memberships(customer_groups(name))')
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch groups
  const { data: groups } = await supabase
    .from('customer_groups')
    .select('*')
    .order('name');

  return (
    <div>
      <div className={styles.sectionHeader} style={{ marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 className={styles.pageTitle}>Customers & Groups</h1>
          <p className={styles.pageSubtitle}>Manage your email contacts and segmentation.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary">
            New Group
          </button>
          <button className="btn btn-primary">
            Import Contacts
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
        
        {/* Groups Sidebar */}
        <div style={{ flex: '0 0 280px' }}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-4)' }}>Groups</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--gold-500)', borderBottom: '1px solid var(--surface-border)', cursor: 'pointer' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>All Customers</p>
            </div>
            {groups?.map(group => (
              <div key={group.id} style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background var(--duration-fast)' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>{group.name}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{group.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.tableContainer} style={{ marginBottom: 0 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Groups</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {customers?.map(customer => (
                  <tr key={customer.id}>
                    <td><div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{customer.email}</div></td>
                    <td>
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                        {customer.customer_group_memberships?.map((m: any, i: number) => (
                          <span key={i} className="badge" style={{ background: 'var(--bg-tertiary)' }}>
                            {m.customer_groups?.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!customers || customers.length === 0) && (
                  <tr>
                    <td colSpan={4}>
                      <div className={styles.emptyState}>
                        No customers found. Try importing some.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
