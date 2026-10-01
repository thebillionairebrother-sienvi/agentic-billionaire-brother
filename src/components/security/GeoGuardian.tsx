'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function GeoGuardian() {
    const pathname = usePathname();

    useEffect(() => {
        // Do not guard region-restricted or API pages
        if (
            !pathname ||
            pathname === '/region-restricted' ||
            pathname.startsWith('/region-restricted/') ||
            pathname.startsWith('/api/')
        ) {
            return;
        }

        // Check for bypass cookie
        if (document.cookie.includes('bb_geo_bypass=valid')) {
            return;
        }

        // Check if previously authorized in session
        if (sessionStorage.getItem('bb_geo_verified') === 'true') {
            return;
        }

        // If previously detected as disallowed in cookie, redirect immediately
        const match = document.cookie.match(/bb_detected_country=([A-Z]{2})/);
        if (match && match[1]) {
            const country = match[1];
            if (!['US', 'CA', 'GB', 'UK'].includes(country)) {
                window.location.replace(`/region-restricted?country=${country}`);
                return;
            }
        }

        // Perform active verification check against /api/geo/check
        fetch('/api/geo/check')
            .then((res) => res.json())
            .then((data) => {
                if (data.allowed === false) {
                    // Out-of-region visitor detected (e.g. Philippines / PH)
                    const country = data.country || 'INTERNATIONAL';
                    document.cookie = `bb_detected_country=${country}; path=/; max-age=86400; SameSite=Lax`;
                    window.location.replace(`/region-restricted?country=${encodeURIComponent(country)}`);
                } else {
                    sessionStorage.setItem('bb_geo_verified', 'true');
                    window.dispatchEvent(new CustomEvent('bb:geo-authorized'));
                }
            })
            .catch((err) => {
                console.warn('[GeoGuardian] Geo check warning:', err);
            });
    }, [pathname]);

    return null;
}
