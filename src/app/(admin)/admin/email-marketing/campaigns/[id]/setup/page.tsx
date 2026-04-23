'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../email.module.css';

export default function CampaignSetupPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [defaultTime, setDefaultTime] = useState('10:00');

  const launchCampaign = async () => {
    if (!startDate) return alert('Start date is required');
    
    setLoading(true);
    // Mock
    setTimeout(() => {
      alert('Campaign Launched!');
      setLoading(false);
      router.push('/admin/email-marketing/campaigns');
    }, 1000);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Campaign Setup</h1>
        <p className={styles.pageSubtitle}>Configure targeting and schedule your email sequences.</p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-6)' }}>
          
          {/* Targeting Step */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-4)' }}>1. Targeting</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                <input type="radio" name="targeting" value="all" defaultChecked style={{ width: '16px', height: '16px' }} />
                <span className="text-primary text-sm">All Customers</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                <input type="radio" name="targeting" value="groups" style={{ width: '16px', height: '16px' }} />
                <span className="text-primary text-sm">Specific Groups</span>
              </label>
            </div>
          </div>

          <div className="divider" style={{ margin: 'var(--space-6) 0' }} />

          {/* Schedule Step */}
          <div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-4)' }}>2. Schedule</h2>
            
            <div className={styles.formGroup}>
              <label className="label">Send Frequency</label>
              <select 
                value={scheduleMode}
                onChange={e => setScheduleMode(e.target.value)}
                className="input"
              >
                <option value="daily">Daily (One email per day)</option>
                <option value="every_other_day">Every Other Day</option>
                <option value="custom">Custom Schedule</option>
              </select>
            </div>

            <div className={styles.formRow} style={{ marginBottom: 0 }}>
              <div>
                <label className="label">Start Date</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Default Send Time</label>
                <input 
                  type="time"
                  value={defaultTime}
                  onChange={e => setDefaultTime(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

        </div>

        <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            className="btn btn-ghost"
            onClick={() => router.back()}
          >
            Back
          </button>
          <button 
            onClick={launchCampaign}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Launching...' : 'Launch Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
