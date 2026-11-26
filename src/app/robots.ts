import { MetadataRoute } from 'next';

const PRIVATE_DISALLOW = [
  '/admin/',
  '/api/',
  '/board-meeting/',
  '/brief/',
  '/chat/',
  '/commit/',
  '/dashboard/',
  '/office/',
  '/onboard/',
  '/playbook/',
  '/settings/',
  '/ship-pack/',
  '/strategies/',
  '/tasks/',
  '/upgrade/',
  '/delete-account/',
];

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_DISALLOW,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE_DISALLOW,
      })),
    ],
    sitemap: 'https://thebillionairebrother.com/sitemap.xml',
  };
}

