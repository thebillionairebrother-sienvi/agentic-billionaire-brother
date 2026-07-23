import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Our Business Strategist | The Billionaire Brother',
  description: 'Have a question about the Billionaire Brother platform, Derek\'s AI strategies, or billing? Contact our support and operations team directly.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
