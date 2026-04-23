import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import Link from 'next/link';

export default async function EmailMarketingDashboard() {
  await requireAdmin();
  const supabase = await createClient();

  // Basic Stats Queries
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  const { count: totalGroups } = await supabase
    .from('customer_groups')
    .select('*', { count: 'exact', head: true });

  const { count: totalSends } = await supabase
    .from('email_sends')
    .select('*', { count: 'exact', head: true });

  const { count: pendingSchedules } = await supabase
    .from('campaign_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('dispatched', false);

  // Next 5 upcoming sends
  const { data: upcomingSchedules } = await supabase
    .from('campaign_schedules')
    .select(`
      id,
      scheduled_at,
      email_campaigns ( name ),
      email_templates ( subject )
    `)
    .eq('dispatched', false)
    .order('scheduled_at', { ascending: true })
    .limit(5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Email Marketing Overview</h1>
        <p className="text-neutral-400 mt-2">Manage campaigns, funnels, and customer targeting.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-medium text-neutral-400">Total Emails Sent</p>
          <p className="text-3xl font-semibold text-white mt-2">{totalSends || 0}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-medium text-neutral-400">Pending Dispatches</p>
          <p className="text-3xl font-semibold text-white mt-2">{pendingSchedules || 0}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-medium text-neutral-400">Total Customers</p>
          <p className="text-3xl font-semibold text-white mt-2">{totalCustomers || 0}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-medium text-neutral-400">Customer Groups</p>
          <p className="text-3xl font-semibold text-white mt-2">{totalGroups || 0}</p>
        </div>
      </div>

      {/* Action shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-950/40 border border-indigo-900/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white">Generate AI Funnel</h2>
          <p className="text-neutral-400 mt-1 text-sm">Create a 5-email sequence using the Billionaire Brother framework.</p>
          <div className="mt-4">
            <Link href="/admin/email-marketing/compose/funnel" className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors">
              Start Funnel Wizard
            </Link>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-900/20 to-amber-950/20 border border-amber-900/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white">One-Off Campaign</h2>
          <p className="text-neutral-400 mt-1 text-sm">Send a scheduled broadcast to specific customers or groups.</p>
          <div className="mt-4">
            <Link href="/admin/email-marketing/compose" className="inline-flex items-center justify-center px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-sm font-medium rounded-md transition-colors">
              Compose Email
            </Link>
          </div>
        </div>
      </div>

      {/* Upcoming Sends */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Upcoming Scheduled Sends</h2>
          <Link href="/admin/email-marketing/campaigns" className="text-sm text-indigo-400 hover:text-indigo-300">View All Campaigns &rarr;</Link>
        </div>
        <div className="divide-y divide-neutral-800">
          {upcomingSchedules && upcomingSchedules.length > 0 ? (
            upcomingSchedules.map((schedule) => {
              const campaign = schedule.email_campaigns as any;
              const template = schedule.email_templates as any;
              return (
                <div key={schedule.id} className="px-6 py-4 flex justify-between items-center hover:bg-neutral-800/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">{campaign?.name || 'Unnamed Campaign'}</p>
                    <p className="text-sm text-neutral-400 mt-0.5">{template?.subject || 'No Subject'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white font-medium">
                      {new Date(schedule.scheduled_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(schedule.scheduled_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-8 text-center text-neutral-500 text-sm">
              No upcoming scheduled emails.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
