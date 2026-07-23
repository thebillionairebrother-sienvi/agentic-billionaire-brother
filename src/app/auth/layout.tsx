import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Access Terminal & Registration | The Billionaire Brother',
  description: 'Log into your strategy command center or initialize your account to begin the Billionaire Brother protocol. Connect to Derek, your AI business strategist.',
  alternates: {
    canonical: '/auth',
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
