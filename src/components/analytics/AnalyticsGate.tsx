'use client';

import { usePathname } from 'next/navigation';
import { GoogleAnalytics } from '@next/third-parties/google';

interface AnalyticsGateProps {
  gaId?: string;
}

/**
 * Gate Google Analytics execution so that out-of-region visitors,
 * waitlist views, and gated traffic do not contaminate web analytics
 * or agency dashboard reporting.
 */
export function AnalyticsGate({ gaId }: AnalyticsGateProps) {
  const pathname = usePathname();

  if (!gaId) {
    return null;
  }

  // Strictly omit GA4 tracking for region-restricted traffic
  if (pathname === '/region-restricted' || pathname?.startsWith('/region-restricted/')) {
    return null;
  }

  return <GoogleAnalytics gaId={gaId} />;
}
