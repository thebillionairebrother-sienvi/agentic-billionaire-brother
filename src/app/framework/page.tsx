import { PlaybookContent } from '@/components/PlaybookContent';
import Link from 'next/link';
import { Crown, ArrowLeft } from 'lucide-react';
import styles from './framework.module.css';

export default function FrameworkPage() {
    return (
        <div className={styles.container}>
            {/* Minimal Header */}
            <header className={styles.header}>
                <Link href="/" className={styles.backLink}>
                    <ArrowLeft size={18} /> Back to Home
                </Link>
                <div className={styles.brand}>
                    <Crown size={20} className={styles.icon} />
                    <span>The Billionaire Brother</span>
                </div>
                <div style={{ width: '120px' }}></div> {/* Spacer for flex layout */}
            </header>

            <main className={styles.main}>
                <PlaybookContent />
            </main>
        </div>
    );
}
