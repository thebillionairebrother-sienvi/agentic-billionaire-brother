'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import styles from './ResetStrategyButton.module.css';

export function ResetStrategyButton() {
    const [showModal, setShowModal] = useState(false);
    const [resetting, setResetting] = useState(false);
    const router = useRouter();

    const handleReset = async () => {
        setResetting(true);
        try {
            const res = await fetch('/api/reset-strategy', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to reset');
            router.push('/onboard');
            router.refresh();
        } catch (err) {
            console.error('Reset failed:', err);
            setResetting(false);
            setShowModal(false);
        }
    };

    return (
        <>
            <button
                className={styles.resetButton}
                onClick={() => setShowModal(true)}
                title="Reset and start a new strategy"
            >
                <RotateCcw size={14} />
                Start New Strategy
            </button>

            {showModal && (
                <div className={styles.overlay} onClick={() => !resetting && setShowModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <button
                            className={styles.closeButton}
                            onClick={() => setShowModal(false)}
                            disabled={resetting}
                        >
                            <X size={18} />
                        </button>

                        <div className={styles.warningIcon}>
                            <AlertTriangle size={32} />
                        </div>

                        <h2 className={styles.modalTitle}>Start a New Strategy?</h2>
                        <p className={styles.modalText}>
                            This will <strong>permanently delete</strong> your current strategy,
                            all tasks, progress, and weekly data. You&apos;ll go through a fresh
                            interview with Derek to build a new plan.
                        </p>
                        <p className={styles.modalSubtext}>
                            This action cannot be undone.
                        </p>

                        <div className={styles.modalActions}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowModal(false)}
                                disabled={resetting}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={handleReset}
                                disabled={resetting}
                            >
                                {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
