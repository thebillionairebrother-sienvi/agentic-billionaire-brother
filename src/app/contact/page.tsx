'use client';

import { useState } from 'react';
import { PolicyLayout } from '@/components/PolicyLayout';
import { Send, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

export default function ContactStrategist() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'strategy',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setLoading(true);
    // Simulate API request
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <PolicyLayout title="Contact Strategist" subtitle="Red-Team Hotline">
      {submitted ? (
        <div className={styles.successState}>
          <CheckCircle size={48} className={styles.successIcon} />
          <h2 className={styles.successTitle}>TRANSMISSION RECEIVED</h2>
          <p className={styles.successMessage}>
            Your request has been dispatched to Derek's strategist operations center. 
            We review operational metrics, not excuses. If your message contains the latter, 
            expect it to be ignored.
          </p>
          <p className={styles.successSub}>
            Response window: 24-48 hours. Get back to shipping in the meantime.
          </p>
          <div className={styles.successActions}>
            <Link href="/" className="btn btn-primary">
              Return to Home <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.introText}>
            Need billing assistance? Want to appeal a strategy score? Have an operational emergency? 
            Fill out the hotline parameters. No fluff, just detail.
          </p>

          <div className={styles.fieldGroup}>
            <label htmlFor="name" className={styles.label}>Your Name / Alias</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Founder #41"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>Business Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="category" className={styles.label}>Hotline Parameter (Category)</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={styles.select}
            >
              <option value="strategy">Business Strategy &amp; Score Audit</option>
              <option value="billing">Billing &amp; Subscription Issue</option>
              <option value="deletion">Account &amp; Deletion Request</option>
              <option value="bug">Technical System Issue</option>
              <option value="feedback">Brutal Feedback / Other</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="message" className={styles.label}>Detailed Description</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Provide exact metrics, screenshots context, or problem descriptions. Keep it structured."
              required
              className={styles.textarea}
              rows={5}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !formData.name || !formData.email || !formData.message}
            className={styles.submitBtn}
          >
            {loading ? 'TRANSMITTING...' : 'DISPATCH TO OPERATORS →'}
          </button>
        </form>
      )}
    </PolicyLayout>
  );
}
