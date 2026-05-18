'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, Camera, CheckCircle, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './RevenueWinModal.module.css';

interface RevenueWinModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export function RevenueWinModal({ onClose, onSuccess }: RevenueWinModalProps) {
    const [revenue, setRevenue] = useState('');
    const [platform, setPlatform] = useState('');
    const [headline, setHeadline] = useState('');
    const [consent, setConsent] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleFileSelect = useCallback((f: File) => {
        if (!f.type.startsWith('image/')) {
            setError('Please upload an image file (JPEG, PNG, or WebP)');
            return;
        }
        if (f.size > 5 * 1024 * 1024) {
            setError('File must be under 5MB');
            return;
        }
        setFile(f);
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(f);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFileSelect(f);
    }, [handleFileSelect]);

    const handleSubmit = async () => {
        if (!consent) {
            setError('Please agree to the consent checkbox before submitting.');
            return;
        }
        if (!file && !headline.trim()) {
            setError('Please upload a screenshot or add a win headline.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            let screenshotPath: string | null = null;

            // Upload screenshot to Supabase Storage
            if (file) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                const ext = file.name.split('.').pop() || 'png';
                const fileName = `${user.id}/${Date.now()}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('social-proof')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
                screenshotPath = fileName;
            }

            // Submit win record
            const res = await fetch('/api/revenue-wins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monthly_revenue: revenue ? parseInt(revenue, 10) : null,
                    platform: platform || null,
                    win_headline: headline.trim() || null,
                    screenshot_path: screenshotPath,
                    consent_given: true,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Submission failed');
            }

            setSuccess(true);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>

                {success ? (
                    <div className={styles.success}>
                        <div className={styles.successIcon}>
                            <CheckCircle size={28} />
                        </div>
                        <h3 className={styles.successTitle}>Win Submitted! 🎉</h3>
                        <p className={styles.successText}>
                            Thanks for sharing your success! We&apos;ll review it shortly and may feature it to inspire other founders.
                        </p>
                        <button className="btn btn-primary" onClick={onClose}>
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={styles.headerIcon}>
                            <Trophy size={24} />
                        </div>
                        <h2 className={styles.title}>Share Your Win</h2>
                        <p className={styles.subtitle}>
                            Crushing it? Share a screenshot of your revenue dashboard (Stripe, PayPal, etc.) — we may feature your success story to inspire other founders.
                        </p>

                        {/* Win Headline */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel} htmlFor="win-headline">
                                Win Headline
                            </label>
                            <input
                                id="win-headline"
                                type="text"
                                className="input"
                                placeholder='e.g. "Hit $10K MRR using the cold email strategy"'
                                value={headline}
                                onChange={(e) => setHeadline(e.target.value)}
                                maxLength={120}
                            />
                        </div>

                        {/* Revenue Amount */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel} htmlFor="win-revenue">
                                Monthly Revenue (optional)
                            </label>
                            <div className={styles.revenueInputWrapper}>
                                <input
                                    id="win-revenue"
                                    type="number"
                                    className={`input ${styles.revenueInput}`}
                                    placeholder="5,000"
                                    value={revenue}
                                    onChange={(e) => setRevenue(e.target.value)}
                                    min="0"
                                    step="100"
                                />
                            </div>
                        </div>

                        {/* Platform */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel} htmlFor="win-platform">
                                Platform
                            </label>
                            <select
                                id="win-platform"
                                className={styles.selectInput}
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                            >
                                <option value="">Select platform...</option>
                                <option value="stripe">Stripe</option>
                                <option value="paypal">PayPal</option>
                                <option value="gumroad">Gumroad</option>
                                <option value="shopify">Shopify</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {/* Screenshot Upload */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>
                                Revenue Dashboard Screenshot
                            </label>
                            {preview ? (
                                <div className={styles.preview}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={preview} alt="Screenshot preview" className={styles.previewImg} />
                                    <button
                                        className={styles.previewRemove}
                                        onClick={() => { setFile(null); setPreview(null); }}
                                        aria-label="Remove screenshot"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className={`${styles.dropZone} ${dragging ? styles.dropZoneDrag : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleDrop}
                                >
                                    <div className={styles.dropZoneIcon}>
                                        {dragging ? <Camera size={32} /> : <Upload size={32} />}
                                    </div>
                                    <p className={styles.dropZoneText}>
                                        {dragging ? 'Drop it here!' : 'Click or drag to upload'}
                                    </p>
                                    <p className={styles.dropZoneHint}>JPEG, PNG, or WebP — max 5MB</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileSelect(f);
                                }}
                            />
                        </div>

                        {/* Consent */}
                        <div className={styles.consentRow}>
                            <input
                                id="win-consent"
                                type="checkbox"
                                className={styles.consentCheckbox}
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                            />
                            <label htmlFor="win-consent" className={styles.consentText}>
                                I&apos;m cool with my screenshot and win being used in marketing materials to inspire other founders. My personal info (email, name) won&apos;t be shared publicly.
                            </label>
                        </div>

                        {error && <p className={styles.error}>{error}</p>}

                        <button
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={handleSubmit}
                            disabled={uploading || !consent}
                        >
                            {uploading ? 'Submitting...' : 'Submit My Win 🏆'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
