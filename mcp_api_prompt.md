# Reusable Prompt: Scaffold MCP REST API Endpoints

> **Usage**: Paste this prompt into any AI coding assistant when starting a new Next.js + Supabase project and you want a full set of machine-consumable REST API endpoints scaffolded automatically.

---

```
I need you to build a complete MCP (Machine-Consumable Platform) REST API layer for this Next.js (App Router) + Supabase project. These endpoints are NOT for the browser UI — they are consumed by AI agents, automation scripts, and external tools. They must bypass Supabase RLS using a service-role admin client and be protected by a static API key.

---

## STEP 1: DISCOVER THE SCHEMA

Before writing any code, introspect this project to understand the data model:

1. Read all files in `supabase/migrations/` to identify every table, column, type, foreign key, and relationship.
2. Check for any existing type definitions (e.g., `types/supabase.ts`, `database.types.ts`, or generated types).
3. Scan existing Supabase queries in the codebase (`from('table_name')`) to understand how tables are used and which joins/filters are common.
4. Identify parent-child relationships (e.g., workspace → members, task → subtasks, task → comments).

Produce a brief summary of discovered tables and their relationships before scaffolding.

---

## STEP 2: CREATE THE FOUNDATION

### Auth Module — `app/api/mcp/auth.ts`

Create a shared auth function with this exact behavior:
- Extract `Authorization: Bearer <token>` from the request header.
- Compare the token against `process.env.MCP_API_KEY`.
- Return `null` if valid (auth passed).
- Return `Response.json({ success: false, error: '...' }, { status: 401 })` if invalid or missing.
- Return a 500 if `MCP_API_KEY` env var is not configured.

### Admin Supabase Client — `utils/supabase/admin.ts`

Create a `createAdminClient()` function:
- Use `createClient` from `@supabase/supabase-js` with `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- Disable `autoRefreshToken` and `persistSession` (server-only, stateless context).
- This client bypasses RLS entirely — it must ONLY be used inside MCP routes.

If this file already exists, reuse it.

---

## STEP 3: SCAFFOLD ENDPOINTS

For EVERY table discovered in Step 1, create REST endpoints under `app/api/mcp/<resource>/`.

### Routing Convention:
```
app/api/mcp/<resource>/route.ts                    → GET (list), POST (create)
app/api/mcp/<resource>/[<resourceId>]/route.ts     → GET (detail), PATCH (update), DELETE (remove)
```

For significant child resources (e.g., a "comments" table that belongs to a "tasks" table), nest them:
```
app/api/mcp/<parent>/[<parentId>]/<child>/route.ts
```

For action-oriented endpoints (e.g., "mark as complete", "archive"), create them as:
```
app/api/mcp/<resource>/[<resourceId>]/<action>/route.ts  → POST
```

### What Each Handler Must Do:

**GET (list):**
- Accept optional query params for filtering (one per filterable column).
- Require the parent foreign key as a query param if the table has one (e.g., `?workspaceId=`).
- Default sort: `order('created_at', { ascending: false })`.
- Support optional `limit` param.
- For JSONB array columns, filter client-side in JS after the Supabase query.

**GET (detail):**
- Fetch by primary key from URL param.
- Return 404 if not found.

**POST (create):**
- Parse body with `await request.json()`.
- Validate required fields — return 400 with a clear message listing missing fields.
- Insert via admin client, return the created row with status 201.

**PATCH (update):**
- Parse body with `await request.json()`.
- Use an `allowedFields` whitelist array containing every mutable column for that table.
- Iterate over `allowedFields`, only including fields present in the body. Never pass raw body to `.update()`.
- Return 400 if no valid fields provided.
- Return the updated row.

**DELETE:**
- Delete by primary key from URL param.
- Return `{ success: true, data: { deleted: id } }`.

---

## STEP 4: HANDLER TEMPLATE

Every single route handler MUST follow this exact structure:

```typescript
import { type NextRequest } from 'next/server';
import { validateMcpAuth } from '<relative-path>/auth';
import { createAdminClient } from '@/utils/supabase/admin';

export async function METHOD(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }  // only for dynamic routes
) {
  // 1. Auth gate — ALWAYS first, no exceptions
  const authError = validateMcpAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();
    
    // 2. Parse inputs (query params for GET, body for POST/PATCH, URL params for dynamic routes)
    // 3. Validate required fields
    // 4. Execute Supabase query
    // 5. Return response

    const { data, error } = await supabase.from('table').select('*');
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
    return Response.json({ success: true, data });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

---

## STEP 5: RULES & CONVENTIONS

1. **Every handler starts with `validateMcpAuth()`** — no exceptions, no shortcuts.
2. **Always use `createAdminClient()`** — never the user-scoped/cookie-based Supabase client.
3. **Consistent response shape on every endpoint**:
   - Success: `{ "success": true, "data": ... }`
   - Error: `{ "success": false, "error": "Human-readable message" }`
4. **HTTP status codes**: 200 (ok), 201 (created), 400 (bad request/validation), 401 (unauthorized), 404 (not found), 500 (server error).
5. **PATCH whitelist pattern** — never pass raw request body to `.update()`.
6. **Include useful joins** — if a table has a foreign key to profiles/users, include a `.select('*, profiles:user_id(full_name, email)')` style join on GET endpoints.
7. **JSDoc-style comment** at the top of each handler: `// GET /api/mcp/resource?param=value`.
8. **No RLS dependency** — these endpoints bypass RLS entirely. The API key IS the auth.
9. **Don't create endpoints for internal/system tables** (e.g., Supabase auth tables, storage.objects, schema_migrations). Only create endpoints for application-domain tables.
10. **Respect existing code style** — match the project's TypeScript conventions, import aliases, and formatting.

---

## STEP 6: ENVIRONMENT SETUP

After scaffolding, remind me to:
1. Generate a strong random `MCP_API_KEY` and add it to `.env.local`.
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (from Supabase dashboard → Settings → API).
3. Add both to deployment environment (Vercel, etc.) — never commit them to git.

Provide a curl test command I can use to verify the endpoints work.

---

## STEP 7: SUMMARY

After completing all endpoints, produce a markdown summary table of every endpoint created:

| Method | Path | Description | Required Params |
|--------|------|-------------|-----------------|
| GET | /api/mcp/... | ... | ... |

This becomes my API reference.
```
