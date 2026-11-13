import type { Metadata } from 'next';
import { CancelTrial } from './CancelTrial';

export const metadata: Metadata = {
    title: 'Cancel your trial | Billionaire Brother',
    robots: { index: false, follow: false },
};

export default async function CancelTrialPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const { token } = await searchParams;
    return <CancelTrial token={token ?? ''} />;
}
