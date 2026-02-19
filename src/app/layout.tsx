import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Billionaire Brother — 3 Ranked Paths. One Choice. Weekly Shipping.',
  description:
    'Your AI-powered business strategist. Get 3 ranked strategy paths with Decision Scores, commit to one, and receive weekly Ship Packs to execute.',
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
        {children}
      </body>
    </html>
  );
}
