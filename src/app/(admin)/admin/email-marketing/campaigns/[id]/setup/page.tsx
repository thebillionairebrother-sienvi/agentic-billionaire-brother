'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CampaignSetupPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [defaultTime, setDefaultTime] = useState('10:00');

  const launchCampaign = async () => {
    if (!startDate) return alert('Start date is required');
    
    setLoading(true);
    // API Call to setup targeting and schedules based on the templates in this campaign
    setTimeout(() => {
      alert('Campaign Launched!');
      setLoading(false);
      router.push('/admin/email-marketing/campaigns');
    }, 1000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Campaign Setup</h1>
        <p className="text-neutral-400 mt-2">Configure targeting and schedule your email sequences.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 space-y-6">
          
          {/* Targeting Step */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">1. Targeting</h2>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input type="radio" name="targeting" value="all" className="text-indigo-600 bg-neutral-900 border-neutral-700" defaultChecked />
                <span className="text-white text-sm">All Customers</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="radio" name="targeting" value="groups" className="text-indigo-600 bg-neutral-900 border-neutral-700" />
                <span className="text-white text-sm">Specific Groups</span>
              </label>
            </div>
          </div>

          <hr className="border-neutral-800" />

          {/* Schedule Step */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">2. Schedule</h2>
            <div className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Send Frequency</label>
                <select 
                  value={scheduleMode}
                  onChange={e => setScheduleMode(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="daily">Daily (One email per day)</option>
                  <option value="every_other_day">Every Other Day</option>
                  <option value="custom">Custom Schedule</option>
                </select>
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Start Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-400 mb-2">Default Send Time</label>
                  <input 
                    type="time"
                    value={defaultTime}
                    onChange={e => setDefaultTime(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

            </div>
          </div>

        </div>

        <div className="bg-neutral-950 px-6 py-4 border-t border-neutral-800 flex justify-between items-center">
          <button 
            className="text-neutral-400 hover:text-white text-sm font-medium transition-colors"
            onClick={() => router.back()}
          >
            Back
          </button>
          <button 
            onClick={launchCampaign}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-medium rounded-md transition-colors"
          >
            {loading ? 'Launching...' : 'Launch Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
