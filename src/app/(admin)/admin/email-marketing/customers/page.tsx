import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

export default async function CustomersPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Fetch customers
  const { data: customers } = await supabase
    .from('customers')
    .select('*, customer_group_memberships(customer_groups(name))')
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch groups
  const { data: groups } = await supabase
    .from('customer_groups')
    .select('*')
    .order('name');

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Customers & Groups</h1>
          <p className="text-neutral-400 mt-2">Manage your email contacts and segmentation.</p>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-md transition-colors">
            New Group
          </button>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors">
            Import Contacts
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Groups Sidebar */}
        <div className="col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-white">Groups</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
            <div className="px-4 py-3 hover:bg-neutral-800/50 cursor-pointer transition-colors bg-neutral-800/30 border-l-2 border-indigo-500">
              <p className="text-sm font-medium text-white">All Customers</p>
            </div>
            {groups?.map(group => (
              <div key={group.id} className="px-4 py-3 hover:bg-neutral-800/50 cursor-pointer transition-colors">
                <p className="text-sm font-medium text-neutral-300">{group.name}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{group.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <div className="col-span-1 lg:col-span-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/50">
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Groups</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {customers?.map(customer => (
                  <tr key={customer.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-white font-medium">{customer.email}</td>
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {customer.customer_group_memberships?.map((m: any, i: number) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {m.customer_groups?.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!customers || customers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-neutral-500">
                      No customers found. Try importing some.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
