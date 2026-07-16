import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
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
        '/delete-account/'
      ],
    },
    sitemap: 'https://mybillionairebrother.com/sitemap.xml',
  };
}

