import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PolicyLayout } from '@/components/PolicyLayout';
import { RegionRestrictedClient } from './RegionRestrictedClient';

export const metadata: Metadata = {
  title: 'Territory Notice — The Billionaire Brother',
  description: 'The Billionaire Brother strategic advisory platform is currently available in the US, Canada, and the UK.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegionRestrictedPage() {
  return (
    <PolicyLayout title="Territory Notice" subtitle="Regional Access Control">
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Checking territorial authorization...</div>}>
        <RegionRestrictedClient />
      </Suspense>
    </PolicyLayout>
  );
}
