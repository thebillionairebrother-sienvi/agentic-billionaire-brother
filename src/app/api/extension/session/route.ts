import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getExtensionCorsHeaders, getExtensionUser, resolveExtensionUserPlan } from '@/lib/extension-auth';

export async function GET(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);

    try {
        const user = await getExtensionUser(request);

        if (!user) {
            return NextResponse.json(
                { userId: null, error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const serviceClient = await createServiceClient();
        const { email, tier, isAdmin, hasRequiredPlan } = await resolveExtensionUserPlan(serviceClient, user);

        return NextResponse.json(
            {
                userId: user.id,
                email,
                tier,
                isAdmin,
                hasRequiredPlan,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        console.error('[extension/session] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', retryable: true },
            { status: 503, headers: corsHeaders }
        );
    }
}

export async function OPTIONS(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

