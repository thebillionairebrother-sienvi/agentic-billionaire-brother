'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// Note: Requires running `npm install isomorphic-dompurify`
import DOMPurify from 'isomorphic-dompurify';

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

    // Here we'd call an API to save the campaign and templates
    // Mocking for now to show the flow
    alert('Campaign Draft Saved!');
    router.push('/admin/email-marketing/campaigns');
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Funnel Wizard</h1>
        <p className="text-neutral-400 mt-2">Generate a 5-email sequence using the Billionaire Brother DNA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Input Form */}
        <div className="col-span-1 space-y-6 bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
          <h2 className="text-lg font-semibold text-white">Brief Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Purpose (Required)</label>
              <textarea 
                value={form.purpose}
                onChange={e => setForm({...form, purpose: e.target.value})}
                placeholder="e.g., Sell the accelerator program"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm min-h-[100px] focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Target Age Group</label>
              <select 
                value={form.ageGroup}
                onChange={e => setForm({...form, ageGroup: e.target.value})}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
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

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Embed Link (Optional)</label>
              <input 
                type="url"
                value={form.embedLink}
                onChange={e => setForm({...form, embedLink: e.target.value})}
                placeholder="https://..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Brand Color HEX (Optional)</label>
              <input 
                type="text"
                value={form.brandColor}
                onChange={e => setForm({...form, brandColor: e.target.value})}
                placeholder="#FF5500"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            {funnelData && (
              <div>
                <label className="block text-sm font-medium text-indigo-400 mb-1">Feedback for Regeneration</label>
                <textarea 
                  value={form.feedback}
                  onChange={e => setForm({...form, feedback: e.target.value})}
                  placeholder="Make email 2 punchier..."
                  className="w-full bg-indigo-950/20 border border-indigo-900/50 rounded-md p-2 text-white text-sm min-h-[80px] focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            )}

            <button 
              onClick={generateFunnel}
              disabled={loading || !form.purpose}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              {loading ? 'Generating...' : funnelData ? 'Regenerate Funnel' : 'Generate Funnel'}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {!funnelData && !loading && (
            <div className="h-full min-h-[400px] border-2 border-dashed border-neutral-800 rounded-xl flex items-center justify-center">
              <p className="text-neutral-500 text-sm">Fill out the brief to generate emails.</p>
            </div>
          )}
          
          {loading && (
            <div className="h-full min-h-[400px] border border-neutral-800 bg-neutral-900 rounded-xl flex flex-col items-center justify-center space-y-4 animate-pulse">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-neutral-400 text-sm">Gemini is writing the funnel...</p>
            </div>
          )}

          {funnelData && !loading && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                <input 
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="Name this campaign to save..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <button 
                  onClick={saveDraft}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors"
                >
                  Save as Draft
                </button>
              </div>

              {funnelData.map((email: any, idx: number) => (
                <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold">
                        {email.sequence_order}
                      </span>
                      <p className="text-sm font-medium text-neutral-300">Subject: <span className="text-white">{email.subject}</span></p>
                    </div>
                  </div>
                  <div className="p-6 bg-white text-black email-preview-content">
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
