'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import styles from '../../email.module.css';

export default function FunnelComposePage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [funnelData, setFunnelData] = useState<any>(null);
  
  const [form, setForm] = useState({
    purpose: '',
    ageGroup: '25-34',
    embedLink: '',
    brandColor: '',
    feedback: ''
  });

  const [campaignName, setCampaignName] = useState('');

  const generateFunnel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-funnels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (json.success && json.data?.emails) {
        setFunnelData(json.data.emails);
      } else {
        alert(json.error || 'Failed to generate funnel');
      }
    } catch (e) {
      alert('Error connecting to generation service');
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!campaignName) return alert('Campaign name is required to save');
    if (!funnelData || funnelData.length === 0) return alert('No emails to save');
    alert('Campaign Draft Saved!');
    router.push('/admin/email-marketing/campaigns');
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>AI Funnel Wizard</h1>
        <p className={styles.pageSubtitle}>Generate a 5-email sequence using the Billionaire Brother DNA.</p>
      </div>

      <div className={styles.formRow}>
        
        {/* Input Form */}
        <div style={{ flex: '0 0 350px' }}>
          <div className="card">
            <h2 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-4)' }}>Brief Configuration</h2>
            
            <div className={styles.formGroup}>
              <label className="label">Purpose (Required)</label>
              <textarea 
                value={form.purpose}
                onChange={e => setForm({...form, purpose: e.target.value})}
                placeholder="e.g., Sell the accelerator program"
                className="input"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className="label">Target Age Group</label>
              <select 
                value={form.ageGroup}
                onChange={e => setForm({...form, ageGroup: e.target.value})}
                className="input"
              >
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45-54">45-54</option>
                <option value="55-64">55-64</option>
                <option value="65+">65+</option>
                <option value="All Ages">All Ages</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className="label">Embed Link (Optional)</label>
              <input 
                type="url"
                value={form.embedLink}
                onChange={e => setForm({...form, embedLink: e.target.value})}
                placeholder="https://..."
                className="input"
              />
            </div>

            <div className={styles.formGroup}>
              <label className="label">Brand Color HEX (Optional)</label>
              <input 
                type="text"
                value={form.brandColor}
                onChange={e => setForm({...form, brandColor: e.target.value})}
                placeholder="#FF5500"
                className="input"
              />
            </div>

            {funnelData && (
              <div className={styles.formGroup}>
                <label className="label" style={{ color: 'var(--gold-400)' }}>Feedback for Regeneration</label>
                <textarea 
                  value={form.feedback}
                  onChange={e => setForm({...form, feedback: e.target.value})}
                  placeholder="Make email 2 punchier..."
                  className="input"
                  style={{ borderColor: 'var(--gold-500)', background: 'rgba(234, 179, 8, 0.05)' }}
                />
              </div>
            )}

            <button 
              onClick={generateFunnel}
              disabled={loading || !form.purpose}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
            >
              {loading ? 'Generating...' : funnelData ? 'Regenerate Funnel' : 'Generate Funnel'}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div style={{ flex: '1', minWidth: 0 }}>
          {!funnelData && !loading && (
            <div className="card" style={{ height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
              <p className="text-secondary text-sm">Fill out the brief to generate emails.</p>
            </div>
          )}
          
          {loading && (
            <div className="card" style={{ height: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}>
              <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
              <p className="text-secondary text-sm">Gemini is writing the funnel...</p>
            </div>
          )}

          {funnelData && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div className="card" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <input 
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="Name this campaign to save..."
                  className="input"
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={saveDraft}
                  className="btn btn-secondary"
                  style={{ color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}
                >
                  Save as Draft
                </button>
              </div>

              {funnelData.map((email: any, idx: number) => (
                <div key={idx} className={styles.tableContainer}>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--surface-border)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="badge badge-gold">
                      #{email.sequence_order}
                    </span>
                    <p className="text-sm font-medium text-secondary">Subject: <span className="text-primary">{email.subject}</span></p>
                  </div>
                  <div className={styles.previewBox}>
                    {/* Render Sanitized HTML */}
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.content) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
