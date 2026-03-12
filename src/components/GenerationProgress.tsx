'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, CheckCircle, AlertCircle, Brain, Shield, Sparkles } from 'lucide-react';
import styles from './GenerationProgress.module.css';

interface GenerationProgressProps {
    jobId: string;
    onComplete: () => void;
    onTimeout?: () => void;
    title?: string;
}

const STEPS = [
    { label: 'Analyzing your profile...', icon: Brain },
    { label: 'Generating strategies...', icon: Sparkles },
    { label: 'Running Quality Check...', icon: Shield },
    { label: 'Preparing results...', icon: CheckCircle },
];

const TIMEOUT_MS = 90_000; // 90 seconds

export function GenerationProgress({ jobId, onComplete, onTimeout, title = 'Generating Your Strategies' }: GenerationProgressProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [timedOut, setTimedOut] = useState(false);
    const step2Scheduled = useRef(false);
    const completeCalled = useRef(false);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;
    const startTimeRef = useRef(Date.now());

    const pollJob = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs/${jobId}`);
            const data = await res.json();

            if (data.status === 'processing') {
                setCurrentStep((prev) => Math.max(prev, 1));
                if (!step2Scheduled.current) {
                    step2Scheduled.current = true;
                    setTimeout(() => setCurrentStep((prev) => Math.max(prev, 2)), 8000);
                }

                // Check for timeout
                if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
                    setTimedOut(true);
                    setError('Generation is taking longer than expected. Please try again.');
                    onTimeout?.();
                    return true;
                }
            }

            if (data.status === 'completed') {
                setCurrentStep(STEPS.length); // all checkmarks
                if (!completeCalled.current) {
                    completeCalled.current = true;
                    setTimeout(() => onCompleteRef.current(), 1500);
                }
                return true;
            }

            if (data.status === 'failed') {
                setError(data.error || 'Generation failed. Please try again.');
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }, [jobId]);

    useEffect(() => {
        const interval = setInterval(async () => {
            const done = await pollJob();
            if (done) clearInterval(interval);
        }, 2000);

        pollJob();

        return () => clearInterval(interval);
    }, [pollJob]);

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <div className={styles.pulse} />
                <h2 className="heading-lg">{title}</h2>
                <p className="text-secondary">
                    Your Billionaire Brother is working on your custom strategies. This usually takes 30-60 seconds.
                </p>

                <div className={styles.steps}>
                    {STEPS.map((step, i) => {
                        const isActive = i === currentStep;
                        const isDone = i < currentStep;
                        const Icon = step.icon;

                        return (
                            <div
                                key={i}
                                className={`${styles.step} ${isActive ? styles.active : ''} ${isDone ? styles.done : ''}`}
                            >
                                <div className={styles.stepIcon}>
                                    {isDone ? (
                                        <CheckCircle size={20} />
                                    ) : isActive ? (
                                        <Loader2 size={20} className={styles.spinner} />
                                    ) : (
                                        <Icon size={20} />
                                    )}
                                </div>
                                <span>{step.label}</span>
                            </div>
                        );
                    })}
                </div>

                {error && (
                    <div className={styles.error}>
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {timedOut && (
                    <button
                        className="btn btn-primary"
                        style={{ marginTop: 'var(--space-4)' }}
                        onClick={() => window.location.reload()}
                    >
                        Try Again
                    </button>
                )}
            </div>
        </div>
    );
}
