import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: identities } = await supabase
    .from('sender_identities')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: suppressions } = await supabase
    .from('suppressions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-neutral-400 mt-2">Manage sender identities and suppressions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sender Identities */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Sender Identities</h2>
            <button className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-md transition-colors">
              Add Domain
            </button>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
            {identities?.map(id => (
              <div key={id.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-white">{id.from_name} &lt;{id.from_email}&gt;</p>
                    <p className="text-xs text-neutral-500 mt-1">Domain: {id.domain}</p>
                  </div>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${id.spf_verified ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      SPF {id.spf_verified ? 'OK' : 'FAIL'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${id.dkim_verified ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      DKIM {id.dkim_verified ? 'OK' : 'FAIL'}
                    </span>
                  </div>
                </div>
                {(!id.spf_verified || !id.dkim_verified) && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded p-3">
                    <p className="text-xs text-amber-400">DNS records require verification. Add the provided TXT records to your domain registrar.</p>
                  </div>
                )}
              </div>
            ))}
            {(!identities || identities.length === 0) && (
              <div className="p-6 text-center text-sm text-neutral-500">
                No sender identities configured.
              </div>
            )}
          </div>
        </div>

        {/* Suppressions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Suppression List</h2>
            <button className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-md transition-colors">
              Manual Add
            </button>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
            {suppressions?.map(sub => (
              <div key={sub.id} className="p-4 flex justify-between items-center hover:bg-neutral-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{sub.email}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Reason: {sub.reason || 'Unsubscribed'}</p>
                </div>
                <button className="text-xs text-red-400 hover:text-red-300 font-medium">Remove</button>
              </div>
            ))}
            {(!suppressions || suppressions.length === 0) && (
              <div className="p-6 text-center text-sm text-neutral-500">
                No emails in the suppression list.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
