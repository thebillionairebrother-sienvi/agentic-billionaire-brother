import { createMobileAwareClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export async function getExtensionUser(request: Request): Promise<User | null> {
    const { user } = await createMobileAwareClient(request);
    if (user) return user;

    // In local development, fall back to Spencer's account for seamless extension testing
    if (process.env.NODE_ENV === 'development') {
        return {
            id: '2208e1d4-20e7-4b7f-a672-7477202d8c8a',
            email: 'spenceralmodiel@gmail.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        } as User;
    }

    return null;
}