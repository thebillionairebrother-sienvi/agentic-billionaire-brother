'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Fires a gtag page_view event. Called on initial mount and on every
 * client-side route change via the usePathname hook.
 */
function pageView(url: string) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  window.gtag('config', GA_MEASUREMENT_ID, { page_path: url });
}

export function GoogleAnalytics() {
  const pathname = usePathname();

  // Track route changes in the App Router (replaces the old router events API)
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    pageView(pathname);
  }, [pathname]);

  if (!GA_MEASUREMENT_ID) {
    // Don't render anything if the env var is missing — avoids runtime errors.
    return null;
  }

  return (
    <>
      {/* Load the GA script after the page is interactive (non-blocking) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}