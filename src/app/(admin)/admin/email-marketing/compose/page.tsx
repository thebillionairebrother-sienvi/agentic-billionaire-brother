'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    // In a real app, this would POST to an API to create:
    // 1. A campaign with name `Scheduled: ${subject}`
    // 2. An email_template attached to it
    // 3. Insert targeting rows
    // 4. Insert a campaign_schedules row
    // 5. Update campaign status to 'active'
    
    setTimeout(() => {
      alert('Scheduled Successfully!');
      setLoading(false);
      router.push('/admin/email-marketing/campaigns');
    }, 1000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Compose One-Off Email</h1>
        <p className="text-neutral-400 mt-2">Send a broadcast or scheduled email outside of a funnel.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 space-y-6">
          
          {/* Targeting */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Recipients</label>
            <select 
              value={form.targetType}
              onChange={e => setForm({...form, targetType: e.target.value})}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Customers</option>
              <option value="group">Specific Groups</option>
              <option value="individual">Specific Individuals</option>
            </select>
            {form.targetType !== 'all' && (
              <p className="text-xs text-indigo-400 mt-2">
                (Target selection UI would appear here)
              </p>
            )}
          </div>

          <hr className="border-neutral-800" />

          {/* Email Content */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Subject Line</label>
              <input 
                type="text"
                value={form.subject}
                onChange={e => setForm({...form, subject: e.target.value})}
                placeholder="Subject..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Message (HTML Support)</label>
              <div className="bg-neutral-950 border border-neutral-800 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 transition-shadow">
                <div className="bg-neutral-900 px-3 py-2 border-b border-neutral-800 flex space-x-2">
                  <button className="text-neutral-400 hover:text-white px-2 py-1 text-xs font-bold font-serif">B</button>
                  <button className="text-neutral-400 hover:text-white px-2 py-1 text-xs italic font-serif">I</button>
                  <button className="text-neutral-400 hover:text-white px-2 py-1 text-xs font-serif underline">U</button>
                  <div className="w-px h-4 bg-neutral-700 my-auto mx-2"></div>
                  <button className="text-neutral-400 hover:text-white px-2 py-1 text-xs">&lt;/&gt;</button>
                </div>
                <textarea 
                  value={form.content}
                  onChange={e => setForm({...form, content: e.target.value})}
                  placeholder="Write your email here..."
                  className="w-full bg-neutral-950 p-4 text-white text-sm min-h-[300px] outline-none resize-y"
                />
              </div>
            </div>
          </div>

          <hr className="border-neutral-800" />

          {/* Scheduling */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Schedule Send</label>
            <div className="flex space-x-4">
              <input 
                type="date"
                value={form.scheduleDate}
                onChange={e => setForm({...form, scheduleDate: e.target.value})}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <input 
                type="time"
                value={form.scheduleTime}
                onChange={e => setForm({...form, scheduleTime: e.target.value})}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

        </div>

        <div className="bg-neutral-950 px-6 py-4 border-t border-neutral-800 flex justify-between items-center">
          <button 
            className="text-neutral-400 hover:text-white text-sm font-medium transition-colors"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-md transition-colors">
              Save Draft
            </button>
            <button 
              onClick={saveAndSchedule}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              {loading ? 'Scheduling...' : 'Schedule Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
