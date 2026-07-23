import { type NextRequest } from 'next/server';
import { validateMcpAuth } from '../auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { TABLE_CONFIGS } from '../config';

// GET /api/mcp/[resource]
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ resource: string }> }
) {
    // 1. Auth gate
    const authError = validateMcpAuth(request);
    if (authError) return authError;

    try {
        const { resource } = await props.params;
        const config = TABLE_CONFIGS[resource];

        if (!config) {
            return Response.json(
                {
                    success: false,
                    error: `Invalid resource: "${resource}". Supported resources are: ${Object.keys(TABLE_CONFIGS).join(', ')}`,
                },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();
        const { searchParams } = request.nextUrl;

        // 2. Validate required parent filter
        if (config.parentFilterField) {
            const requiredFields = Array.isArray(config.parentFilterField)
                ? config.parentFilterField
                : [config.parentFilterField];
            
            const hasAtLeastOne = requiredFields.some(field => searchParams.has(field));
            if (!hasAtLeastOne) {
                return Response.json(
                    {
                        success: false,
                        error: `Query parameter error: This endpoint requires a parent filter parameter (e.g. ${requiredFields.map(f => `?${f}=<id>`).join(' or ')}).`,
                    },
                    { status: 400 }
                );
            }
        }

        // 3. Build Supabase query
        let query = supabase.from(config.tableName).select(config.select || '*');

        // Apply filters (excluding special parameters like limit, order)
        const activeFilters: Array<{ key: string; value: string }> = [];
        searchParams.forEach((value, key) => {
            if (['limit', 'order', 'offset'].includes(key)) return;

            // Check if key is valid for this table schema (in allowedFields or is id / user_id)
            const isValidField =
                key === 'id' ||
                key === 'user_id' ||
                config.allowedFields.includes(key) ||
                (Array.isArray(config.parentFilterField)
                    ? config.parentFilterField.includes(key)
                    : config.parentFilterField === key);

            if (isValidField) {
                activeFilters.push({ key, value });
                // We'll apply non-array filters directly in Supabase
                // Note: For JSONB arrays, we will apply client-side filtering below
            }
        });

        // Apply non-array filters on DB level
        // (If we suspect it's a JSONB array column, we skip database-level .eq filter to avoid casting errors)
        const jsonbFields = [
            'strengths', 'weaknesses', 'no_go_constraints', 'existing_assets',
            'channel_focus', 'first_7_day_plan', 'risks', 'mitigations', 'kpis',
            'board_meeting_notes', 'kill_list', 'keep_list', 'double_list', 'content'
        ];

        for (const { key, value } of activeFilters) {
            if (!jsonbFields.includes(key)) {
                query = query.eq(key, value);
            }
        }

        // Sort order
        const sortColumn = config.defaultSort || 'created_at';
        query = query.order(sortColumn, { ascending: false });

        // Limit
        const limitParam = searchParams.get('limit');
        if (limitParam) {
            const limit = parseInt(limitParam, 10);
            if (!isNaN(limit)) {
                query = query.limit(limit);
            }
        }

        const { data, error } = await query;
        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        // 4. Client-side JSONB array filtering if requested
        let result = data || [];
        for (const { key, value } of activeFilters) {
            if (jsonbFields.includes(key) && result.length > 0) {
                result = result.filter((item: any) => {
                    const val = item[key];
                    if (Array.isArray(val)) {
                        return val.some((el: any) => String(el) === value);
                    }
                    if (val && typeof val === 'object') {
                        // Check if key exists in JSON object or matches value
                        return val[value] !== undefined || JSON.stringify(val).includes(value);
                    }
                    return String(val) === value;
                });
            }
        }

        return Response.json({ success: true, data: result });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST /api/mcp/[resource]
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ resource: string }> }
) {
    // 1. Auth gate
    const authError = validateMcpAuth(request);
    if (authError) return authError;

    try {
        const { resource } = await props.params;
        const config = TABLE_CONFIGS[resource];

        if (!config) {
            return Response.json(
                { success: false, error: `Invalid resource: "${resource}".` },
                { status: 400 }
            );
        }

        const body = await request.json();

        // 2. Validate required fields
        const missingFields = config.requiredFields.filter(
            field => body[field] === undefined || body[field] === null
        );
        if (missingFields.length > 0) {
            return Response.json(
                {
                    success: false,
                    error: `Validation error: Missing required fields: ${missingFields.join(', ')}`,
                },
                { status: 400 }
            );
        }

        // 3. Build insert payload (whitelist fields only)
        const insertPayload: Record<string, any> = {};
        
        // Include allowed fields if they exist in the body
        config.allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                insertPayload[field] = body[field];
            }
        });

        // Add any additional required fields that might not be in the allowedFields list
        config.requiredFields.forEach(field => {
            if (body[field] !== undefined) {
                insertPayload[field] = body[field];
            }
        });

        // Always allow id to be custom-supplied if present (optional)
        if (body.id !== undefined) {
            insertPayload.id = body.id;
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from(config.tableName)
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
