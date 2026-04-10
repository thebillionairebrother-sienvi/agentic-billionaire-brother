import type { Metadata } from 'next';
import './globals.css';
import { FloatingDerekChat } from '@/components/FloatingDerekChat';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';

export const metadata: Metadata = {
  title: 'The Billionaire Brother — Your Business Strategist',
  description:
    'Meet Derek — your Billionaire Brother. He interviews you, builds your strategy, and gives you weekly Action Steps to execute.',
  keywords: ['business strategy', 'AI consultant', 'execution', 'startup'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <GoogleAnalytics />
        {children}
        <FloatingDerekChat />
      </body>
    </html>
  );
}