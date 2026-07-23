import type { Metadata } from 'next';
import './globals.css';
import './tailwind.css';
import { FloatingDerekChat } from '@/components/FloatingDerekChat';
import { GoogleAnalytics } from '@next/third-parties/google';

export const metadata: Metadata = {
  metadataBase: new URL('https://mybillionairebrother.com'),
  title: 'The Billionaire Brother — Your AI Business Strategist',
  description:
    'Meet Derek — your Billionaire Brother AI strategist. He interviews you, builds your strategy, and gives you weekly Action Steps to execute. No fluff. Just metrics and execution.',
  keywords: ['business strategy', 'AI consultant', 'execution', 'startup', 'AI business mentor', 'weekly action steps'],
  openGraph: {
    title: 'The Billionaire Brother — Your AI Business Strategist',
    description: 'Meet Derek — your Billionaire Brother AI strategist. He interviews you, builds your strategy, and gives you weekly Action Steps to execute.',
    url: 'https://mybillionairebrother.com',
    siteName: 'The Billionaire Brother',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'The Billionaire Brother — AI Business Strategist',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Billionaire Brother — Your AI Business Strategist',
    description: 'Meet Derek — your Billionaire Brother AI strategist. He interviews you, builds your strategy, and gives you weekly Action Steps to execute.',
    images: ['/images/og-image.jpg'],
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&amp;family=JetBrains+Mono:wght@400;500;600&amp;family=Space+Grotesk:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'The Billionaire Brother',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: 'AI-powered business strategist that interviews you, builds your strategy, and delivers weekly action steps for execution.',
            url: 'https://mybillionairebrother.com',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free tier available' },
          }) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'The Billionaire Brother',
            url: 'https://mybillionairebrother.com',
            description: 'AI-powered business strategy and execution platform.',
          }) }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID as string} />
        {children}
        <FloatingDerekChat />
      </body>
    </html>
  );
}