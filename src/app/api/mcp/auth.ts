import { type NextRequest } from 'next/server';

/**
 * Validates the Authorization header in the incoming request against MCP_API_KEY.
 * Returns null if authorized, or a Response JSON object indicating failure (401/500).
 */
export function validateMcpAuth(request: NextRequest): Response | null {
    const mcpApiKey = process.env.MCP_API_KEY;

    if (!mcpApiKey) {
        return Response.json(
            { success: false, error: 'MCP_API_KEY is not configured on the server.' },
            { status: 500 }
        );
    }

    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
        return Response.json(
            { success: false, error: 'Authorization header is missing.' },
            { status: 401 }
        );
    }

    if (!authHeader.startsWith('Bearer ')) {
        return Response.json(
            { success: false, error: 'Authorization header must follow "Bearer <token>" format.' },
            { status: 401 }
        );
    }

    const token = authHeader.substring(7).trim();

    if (token !== mcpApiKey) {
        return Response.json(
            { success: false, error: 'Invalid API key.' },
            { status: 401 }
        );
    }

    return null;
}
