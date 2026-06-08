import Link from 'next/link';
import { Crown, ArrowLeft } from 'lucide-react';
import styles from './PolicyLayout.module.css';

interface PolicyLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function PolicyLayout({ children, title, subtitle }: PolicyLayoutProps) {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <Link href="/" className={styles.brand}>
          <div className={styles.logoMark}>
            <Crown size={14} />
          </div>
          <span className={styles.brandText}>THE BILLIONAIRE BROTHER</span>
        </Link>
        <div className={styles.headerSpacer} />
      </header>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.contentCard}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            <div className={styles.divider} />
          </div>
          <div className={styles.content}>
            {children}
          </div>
        </div>
      </main>

      {/* Mini Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>
          © {new Date().getFullYear()} The Billionaire Brother. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
