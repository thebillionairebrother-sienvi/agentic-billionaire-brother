'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../email.module.css';

export default function OneOffComposePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    subject: '',
    content: '',
    targetType: 'all', // all, group, individual
    targetIds: [] as string[],
    scheduleDate: '',
    scheduleTime: '',
  });

  const saveAndSchedule = async () => {
    if (!form.subject || !form.content) return alert('Subject and content are required');
    if (!form.scheduleDate || !form.scheduleTime) return alert('Schedule date and time are required');
    
    setLoading(true);
    // Mock save
    setTimeout(() => {
      alert('Scheduled Successfully!');
      setLoading(false);
      router.push('/admin/email-marketing/campaigns');
    }, 1000);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Compose One-Off Email</h1>
        <p className={styles.pageSubtitle}>Send a broadcast or scheduled email outside of a funnel.</p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-6)' }}>
          
          {/* Targeting */}
          <div className={styles.formGroup}>
            <label className="label">Recipients</label>
            <select 
              value={form.targetType}
              onChange={e => setForm({...form, targetType: e.target.value})}
              className="input"
            >
              <option value="all">All Customers</option>
              <option value="group">Specific Groups</option>
              <option value="individual">Specific Individuals</option>
            </select>
            {form.targetType !== 'all' && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gold-400)', marginTop: 'var(--space-2)' }}>
                (Target selection UI would appear here)
              </p>
            )}
          </div>

          <div className="divider" style={{ margin: 'var(--space-6) 0' }} />

          {/* Email Content */}
          <div className={styles.formGroup}>
            <label className="label">Subject Line</label>
            <input 
              type="text"
              value={form.subject}
              onChange={e => setForm({...form, subject: e.target.value})}
              placeholder="Subject..."
              className="input"
              style={{ fontWeight: 500 }}
            />
          </div>
            
          <div className={styles.formGroup}>
            <label className="label">Message (HTML Support)</label>
            <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: 'var(--space-2)' }}>
                <button style={{ color: 'var(--text-secondary)', padding: '2px 8px', fontSize: 'var(--text-xs)', fontWeight: 'bold', fontFamily: 'serif' }}>B</button>
                <button style={{ color: 'var(--text-secondary)', padding: '2px 8px', fontSize: 'var(--text-xs)', fontStyle: 'italic', fontFamily: 'serif' }}>I</button>
                <button style={{ color: 'var(--text-secondary)', padding: '2px 8px', fontSize: 'var(--text-xs)', textDecoration: 'underline', fontFamily: 'serif' }}>U</button>
                <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)', margin: 'auto var(--space-2)' }} />
                <button style={{ color: 'var(--text-secondary)', padding: '2px 8px', fontSize: 'var(--text-xs)' }}>&lt;/&gt;</button>
              </div>
              <textarea 
                value={form.content}
                onChange={e => setForm({...form, content: e.target.value})}
                placeholder="Write your email here..."
                className="input"
                style={{ border: 'none', borderRadius: 0, minHeight: '300px', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="divider" style={{ margin: 'var(--space-6) 0' }} />

          {/* Scheduling */}
          <div className={styles.formGroup}>
            <label className="label">Schedule Send</label>
            <div className={styles.formRow} style={{ marginBottom: 0 }}>
              <input 
                type="date"
                value={form.scheduleDate}
                onChange={e => setForm({...form, scheduleDate: e.target.value})}
                className="input"
              />
              <input 
                type="time"
                value={form.scheduleTime}
                onChange={e => setForm({...form, scheduleTime: e.target.value})}
                className="input"
              />
            </div>
          </div>

        </div>

        <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            className="btn btn-ghost"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary">
              Save Draft
            </button>
            <button 
              onClick={saveAndSchedule}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Scheduling...' : 'Schedule Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
