import { type NextRequest } from 'next/server';
import { validateMcpAuth } from '../../auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { TABLE_CONFIGS } from '../../config';

// GET /api/mcp/[resource]/[id]
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ resource: string; id: string }> }
) {
    // 1. Auth gate
    const authError = validateMcpAuth(request);
    if (authError) return authError;

    try {
        const { resource, id } = await props.params;
        const config = TABLE_CONFIGS[resource];

        if (!config) {
            return Response.json(
                { success: false, error: `Invalid resource: "${resource}".` },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from(config.tableName)
            .select(config.select || '*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data) {
            return Response.json(
                { success: false, error: `Record with id "${id}" not found in "${resource}".` },
                { status: 404 }
            );
        }

        return Response.json({ success: true, data });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH /api/mcp/[resource]/[id]
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ resource: string; id: string }> }
) {
    // 1. Auth gate
    const authError = validateMcpAuth(request);
    if (authError) return authError;

    try {
        const { resource, id } = await props.params;
        const config = TABLE_CONFIGS[resource];

        if (!config) {
            return Response.json(
                { success: false, error: `Invalid resource: "${resource}".` },
                { status: 400 }
            );
        }

        const body = await request.json();

        // 2. Build update payload (whitelist fields only)
        const updatePayload: Record<string, any> = {};
        let hasPayloadFields = false;

        config.allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                updatePayload[field] = body[field];
                hasPayloadFields = true;
            }
        });

        if (!hasPayloadFields) {
            return Response.json(
                {
                    success: false,
                    error: `Validation error: No valid fields provided for update. Allowed fields are: ${config.allowedFields.join(', ')}`,
                },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from(config.tableName)
            .update(updatePayload)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data) {
            return Response.json(
                { success: false, error: `Record with id "${id}" not found to update.` },
                { status: 404 }
            );
        }

        return Response.json({ success: true, data });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE /api/mcp/[resource]/[id]
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ resource: string; id: string }> }
) {
    // 1. Auth gate
    const authError = validateMcpAuth(request);
    if (authError) return authError;

    try {
        const { resource, id } = await props.params;
        const config = TABLE_CONFIGS[resource];

        if (!config) {
            return Response.json(
                { success: false, error: `Invalid resource: "${resource}".` },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();
        const { error } = await supabase
            .from(config.tableName)
            .delete()
            .eq('id', id);

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({
            success: true,
            data: { deleted: id },
        });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
