import { requireAdmin } from '@/lib/auth/admin';
import Link from 'next/link';

export default async function EmailMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure only admins can access this entire route group
  await requireAdmin();

  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col">
        <div className="p-6">
          <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
            Sienvi Mail
          </h2>
          <p className="text-xs text-neutral-500 mt-1">Admin Only</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <Link href="/admin/email-marketing" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors">
            Dashboard
          </Link>
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Compose</p>
          </div>
          <Link href="/admin/email-marketing/compose/funnel" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors">
            AI Funnel Wizard
          </Link>
          <Link href="/admin/email-marketing/compose" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors">
            One-Off Email
          </Link>
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Manage</p>
          </div>
          <Link href="/admin/email-marketing/campaigns" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors">
            Campaigns
          </Link>
          <Link href="/admin/email-marketing/customers" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors">
            Customers & Groups
          </Link>
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Configuration</p>
          </div>
          <Link href="/admin/email-marketing/settings" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors">
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
