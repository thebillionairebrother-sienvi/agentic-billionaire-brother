'use client';

import { useState, useEffect } from 'react';
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
    const [authorized, setAuthorized] = useState<boolean>(false);

    useEffect(() => {
        // Strictly omit GA4 tracking for region-restricted traffic
        if (!pathname || pathname === '/region-restricted' || pathname.startsWith('/region-restricted/')) {
            setAuthorized(false);
            return;
        }

        // Bypass active
        if (document.cookie.includes('bb_geo_bypass=valid')) {
            setAuthorized(true);
            return;
        }

        // Check if disallowed country is already identified
        const match = document.cookie.match(/bb_detected_country=([A-Z]{2})/);
        if (match && match[1]) {
            if (!['US', 'CA', 'GB', 'UK'].includes(match[1])) {
                setAuthorized(false);
                return;
            }
            setAuthorized(true);
            return;
        }

        if (sessionStorage.getItem('bb_geo_verified') === 'true') {
            setAuthorized(true);
            return;
        }

        const handleAuthorized = () => {
            setAuthorized(true);
        };

        window.addEventListener('bb:geo-authorized', handleAuthorized);
        return () => window.removeEventListener('bb:geo-authorized', handleAuthorized);
    }, [pathname]);

    if (!gaId || !authorized) {
        return null;
    }

    return <GoogleAnalytics gaId={gaId} />;
}
