'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, Globe, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import styles from './page.module.css';

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  AU: 'Australia',
  JP: 'Japan',
  IN: 'India',
  SG: 'Singapore',
  BR: 'Brazil',
  MX: 'Mexico',
  NL: 'Netherlands',
  ES: 'Spain',
  IT: 'Italy',
  SE: 'Sweden',
  CH: 'Switzerland',
  NZ: 'New Zealand',
  AE: 'United Arab Emirates',
};

export function RegionRestrictedClient() {
  const searchParams = useSearchParams();
  const detectedCode = (searchParams.get('country') || '').toUpperCase();
  const detectedName = COUNTRY_NAMES[detectedCode] || detectedCode || 'International Territory';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/leads/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          country: detectedCode || 'OTHER',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit waitlist request.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.restrictedContainer}>
      {/* Status Badges */}
      <div className={styles.badgeRow}>
        <div className={styles.restrictedBadge}>
          <ShieldAlert size={14} /> Territory Gated
        </div>
        {detectedCode && (
          <div className={styles.countryBadge}>
            <Globe size={14} /> Origin: {detectedName} ({detectedCode})
          </div>
        )}
      </div>

      {/* Main Notice */}
      <div className={styles.heroNotice}>
        <h2 className={styles.heroHeading}>
          The Billionaire Brother is currently available only in select markets.
        </h2>
        <p className={styles.heroDescription}>
          Our AI business strategist, proprietary execution frameworks, and automated action engines are licensed and optimized specifically for operations in three primary territories.
        </p>
      </div>

      {/* Authorized Regions List */}
      <div className={styles.territoryBox}>
        <div className={styles.territoryTitle}>Authorized Territories</div>
        <div className={styles.territoryList}>
          <span className={styles.territoryItem}>🇺🇸 United States</span>
          <span className={styles.territoryItem}>🇨🇦 Canada</span>
          <span className={styles.territoryItem}>🇬🇧 United Kingdom</span>
        </div>
      </div>

      {/* Priority Waitlist Card */}
      <div className={styles.formCard}>
        {submitted ? (
          <div className={styles.successBox}>
            <CheckCircle2 size={44} className={styles.successIcon} />
            <h3 className={styles.successTitle}>TRANSMISSION RECORDED</h3>
            <p className={styles.successDesc}>
              Your email has been added to our priority deployment queue for{' '}
              <strong>{detectedName}</strong>. You will receive an exclusive onboarding invite as soon as compliance and infrastructure go live in your jurisdiction.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.formHeader}>
              <h3 className={styles.formTitle}>Request Territory Access</h3>
              <p className={styles.formSubtitle}>
                Leave your business email below to join the priority expansion waitlist.
              </p>
            </div>

            {errorMsg && <div className={styles.errorNotice}>{errorMsg}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="waitlist-email" className={styles.label}>
                  Executive Email
                </label>
                <input
                  type="email"
                  id="waitlist-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@company.com"
                  required
                  disabled={loading}
                  className={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={styles.submitBtn}
              >
                {loading ? 'Submitting...' : 'Join Regional Waitlist'}
                <ArrowRight size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
