import { requireAdmin } from '@/lib/auth/admin';
import Link from 'next/link';
import styles from './email.module.css';

export default async function EmailMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure only admins can access this entire route group
  await requireAdmin();

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>
            Sienvi Mail
          </h2>
          <p className={styles.sidebarSubtitle}>Admin Only</p>
        </div>
        
        <nav className={styles.nav}>
          <Link href="/admin/email-marketing" className={styles.navLink}>
            Dashboard
          </Link>
          
          <div className={styles.navSection}>Compose</div>
          <Link href="/admin/email-marketing/compose/funnel" className={styles.navLink}>
            AI Funnel Wizard
          </Link>
          <Link href="/admin/email-marketing/compose" className={styles.navLink}>
            One-Off Email
          </Link>
          
          <div className={styles.navSection}>Manage</div>
          <Link href="/admin/email-marketing/campaigns" className={styles.navLink}>
            Campaigns
          </Link>
          <Link href="/admin/email-marketing/customers" className={styles.navLink}>
            Customers & Groups
          </Link>
          
          <div className={styles.navSection}>Configuration</div>
          <Link href="/admin/email-marketing/settings" className={styles.navLink}>
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
