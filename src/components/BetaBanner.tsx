'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './BetaBanner.module.css';

const MESSAGES = [
    "🚧 We're in BETA, baby. Shit's being built at lightspeed — expect bugs, expect upgrades, expect greatness.",
    "🧪 Beta mode = you're an early insider. More features dropping weekly. You're ahead of 99% of founders.",
    "⚡ New features shipping faster than your excuses. This is beta — report bugs, earn karma.",
    "🔥 Your Billionaire Brother is evolving. More AI firepower coming. Sit tight, keep shipping.",
    "💎 Beta testers get first dibs on everything. You're family. More tools, more automation, coming soon.",
];

export function BetaBanner() {
    const [dismissed, setDismissed] = useState(true); // start hidden to prevent flash

    useEffect(() => {
        const stored = sessionStorage.getItem('beta-banner-dismissed');
        setDismissed(stored === 'true');
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('beta-banner-dismissed', 'true');
    };

    if (dismissed) return null;

    return (
        <div className={styles.banner}>
            <div className={styles.marqueeTrack}>
                <div className={styles.marquee}>
                    {MESSAGES.map((msg, i) => (
                        <span key={i} className={styles.message}>
                            {msg}
                            <span className={styles.separator}>✦</span>
                        </span>
                    ))}
                    {/* Duplicate for seamless loop */}
                    {MESSAGES.map((msg, i) => (
                        <span key={`dup-${i}`} className={styles.message}>
                            {msg}
                            <span className={styles.separator}>✦</span>
                        </span>
                    ))}
                </div>
            </div>
            <button className={styles.closeBtn} onClick={handleDismiss} aria-label="Close beta banner">
                <X size={14} />
            </button>
        </div>
    );
}
