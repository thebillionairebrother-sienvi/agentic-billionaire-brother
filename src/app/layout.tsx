import type { Metadata } from 'next';
import './globals.css';
import { FloatingDerekChat } from '@/components/FloatingDerekChat';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';

export const metadata: Metadata = {
  title: 'The Billionaire Brother — Your Business Strategist',
  description:
    'Meet Derek — your Billionaire Brother. He interviews you, builds your strategy, and gives you weekly Action Steps to execute.',
  keywords: ['business strategy', 'AI consultant', 'execution', 'startup'],
  openGraph: {
    title: 'The Billionaire Brother — Your Business Strategist',
    description: 'Meet Derek — your Billionaire Brother. He interviews you, builds your strategy, and gives you weekly Action Steps to execute.',
    url: 'https://thebillionairebrother.com',
    siteName: 'The Billionaire Brother',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'The Billionaire Brother',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Billionaire Brother — Your Business Strategist',
    description: 'Meet Derek — your Billionaire Brother. He interviews you, builds your strategy, and gives you weekly Action Steps to execute.',
    images: ['/images/og-image.jpg'],
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
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <GoogleAnalytics />
        {children}
        <FloatingDerekChat />
      </body>
    </html>
  );
}