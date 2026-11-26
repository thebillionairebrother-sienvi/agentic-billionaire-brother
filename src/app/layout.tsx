import type { Metadata } from 'next';
import './globals.css';
import './tailwind.css';
import { FloatingDerekChat } from '@/components/FloatingDerekChat';
import { DerekLeadCapturePopup } from '@/components/DerekLeadCapturePopup';
import { AnalyticsGate } from '@/components/analytics/AnalyticsGate';
import { GeoGuardian } from '@/components/security/GeoGuardian';
import { EmbedLinkGuard } from '@/components/security/EmbedLinkGuard';

export const metadata: Metadata = {
  metadataBase: new URL('https://thebillionairebrother.com'),
  title: 'The Billionaire Brother — Your AI Business Advisor & Strategist',
  description:
    'Meet Derek — your Billionaire Brother AI business advisor. He interviews you, builds your scaling strategy, and delivers weekly action steps. Zero fluff.',
  keywords: [
    'AI business advisor',
    'AI business coach',
    'CEO AI operating system',
    'founder operating system',
    'business scaling framework',
    'AI business decision engine',
    'accountability coach for entrepreneurs',
    'weekly action steps',
  ],
  openGraph: {
    title: 'The Billionaire Brother — Your AI Business Advisor & Strategist',
    description:
      'Meet Derek — your Billionaire Brother AI business advisor. He interviews you, builds your scaling strategy, and delivers weekly action steps. Zero fluff.',
    url: 'https://thebillionairebrother.com',
    siteName: 'The Billionaire Brother',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'The Billionaire Brother — AI Business Advisor & Strategist',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Billionaire Brother — Your AI Business Advisor & Strategist',
    description:
      'Meet Derek — your Billionaire Brother AI business advisor. He interviews you, builds your scaling strategy, and delivers weekly action steps. Zero fluff.',
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
            url: 'https://thebillionairebrother.com',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free tier available' },
          }) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'The Billionaire Brother',
            url: 'https://thebillionairebrother.com',
            description: 'AI-powered business advisor, founder operating system, and weekly execution platform.',
          }) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How is The Billionaire Brother different from ChatGPT or a System One model like Jev?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'ChatGPT gives open-ended chat replies and System One models like Jev make fast programmatic yes/no routing decisions inside developer code. The Billionaire Brother (Derek) is a dedicated AI business advisor and founder operating system that interviews you on your real numbers, pressure-tests your business strategy with comparative probability analysis, and holds you accountable to weekly Action Steps.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which AI is best for founder business decision making and weekly execution?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Founders who need strategic clarity and follow-through need more than a generic prompt box. The Billionaire Brother diagnoses your bottlenecks, turns your business goals into a sequenced scaling framework, and tracks weekly execution check-ins so high-leverage work actually ships.',
                },
              },
              {
                '@type': 'Question',
                name: 'What do I get when I start with The Billionaire Brother?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'You start with a free diagnostic questionnaire and strategy interview with Derek. From your baseline metrics, you receive a tailored business scaling plan, prioritized weekly Action Steps, revenue tracking, and optional browser-extension page audits.',
                },
              },
            ],
          }) }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <GeoGuardian />
        <EmbedLinkGuard />
        <AnalyticsGate gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        {children}
        <FloatingDerekChat />
        <DerekLeadCapturePopup />
      </body>
    </html>
  );
}