import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import Link from 'next/link';

export default async function CampaignsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select(`
      *,
      email_templates (id),
      campaign_schedules (id, scheduled_at, dispatched)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  const getStatusBadge = (dbStatus: string, schedules: any[]) => {
    if (dbStatus === 'draft') return <span className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded text-xs font-medium">Draft</span>;
    if (!schedules || schedules.length === 0) return <span className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded text-xs font-medium">{dbStatus}</span>;

    const now = new Date();
    const allDispatched = schedules.every((s) => s.dispatched);
    const someDispatched = schedules.some((s) => s.dispatched);
    const allPastSchedule = schedules.every((s) => new Date(s.scheduled_at) <= now);

    if (allDispatched) return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs font-medium">Completed</span>;
    if (allPastSchedule && !allDispatched && someDispatched) return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-xs font-medium">Sending</span>;
    if (dbStatus === 'active') return <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded text-xs font-medium">Active</span>;
    
    return <span className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded text-xs font-medium">{dbStatus}</span>;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Campaigns</h1>
          <p className="text-neutral-400 mt-2">Manage your email sequences and one-off broadcasts.</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/admin/email-marketing/compose/funnel" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-md transition-colors">
            New AI Funnel
          </Link>
          <Link href="/admin/email-marketing/compose" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors">
            New Email
          </Link>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/50">
              <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Campaign Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Emails</th>
              <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {campaigns?.map(campaign => (
              <tr key={campaign.id} className="hover:bg-neutral-800/50 transition-colors">
                <td className="px-6 py-4 text-sm text-white font-medium">{campaign.name}</td>
                <td className="px-6 py-4 text-sm">
                  {getStatusBadge(campaign.status, campaign.campaign_schedules || [])}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-300 capitalize">{campaign.campaign_type}</td>
                <td className="px-6 py-4 text-sm text-neutral-400">
                  {campaign.email_templates?.length || 0} template{(campaign.email_templates?.length || 0) !== 1 ? 's' : ''}
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-3">
                  {campaign.status === 'draft' && (
                    <Link href={`/admin/email-marketing/campaigns/${campaign.id}/setup`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                      Setup Schedule
                    </Link>
                  )}
                  <button className="text-neutral-500 hover:text-white font-medium">View</button>
                </td>
              </tr>
            ))}
            {(!campaigns || campaigns.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-neutral-500">
                  No campaigns found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
