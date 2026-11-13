import { redirect } from 'next/navigation';
import { isBetaProgramOver } from '@/lib/billing/config';

export const dynamic = 'force-dynamic';

/** Once the beta program ends, the beta sign-in page sends everyone to /auth. */
export default function BetaAuthLayout({ children }: { children: React.ReactNode }) {
    if (isBetaProgramOver()) redirect('/auth');
    return children;
}
