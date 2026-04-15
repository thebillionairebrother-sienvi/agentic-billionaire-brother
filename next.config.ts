import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,

    /**
     * Security Headers
     * Applied to every response by Next.js at the edge/server level.
     */
    async headers() {
        return [
            {
                // Match all routes
                source: '/(.*)',
                headers: [
                    // Prevent clickjacking — disallow embedding in iframes
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    // Prevent MIME type sniffing
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    // Control cross-origin referrer information leakage
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    // Force HTTPS for 1 year (only in production)
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains',
                    },
                    // Lock down browser APIs not used by this app
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=(self), usb=()',
                    },
                    // Content Security Policy
                    // Locks down script, frame, and media sources to prevent XSS
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            // Default: only allow same-origin
                            "default-src 'self'",
                            // Scripts: self + Next.js inline scripts (needed for hydration) + GA
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
                            // Styles: self + inline (Tailwind/CSS-in-JS)
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            // Fonts: self + Google Fonts
                            "font-src 'self' https://fonts.gstatic.com",
                            // Images: self + data URIs + Giphy + Supabase storage + GA pixel
                            "img-src 'self' data: blob: https://media.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com https://www.google-analytics.com https://*.supabase.co",
                            // Connections: self + Supabase + Gemini + Stripe + GA
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.stripe.com https://www.google-analytics.com https://analytics.google.com https://api.giphy.com",
                            // Frames: Stripe checkout only
                            "frame-src 'none'",
                            // Disallow plugins
                            "object-src 'none'",
                            // Restrict base URI to self
                            "base-uri 'self'",
                            // Only allow form submissions to self
                            "form-action 'self'",
                        ].join('; '),
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
