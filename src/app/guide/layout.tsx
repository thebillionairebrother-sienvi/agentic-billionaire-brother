import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Playbook — AI Business Strategy Framework | The Billionaire Brother',
  description: 'Learn the step-by-step framework to maximize your leverage, build compounding strategies, and execute like a seasoned founder. No fluff. Just the protocol.',
  alternates: {
    canonical: '/guide',
  },
};

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
