# Billionaire Brother — Project Overview

This file exists to give future conversations fast context on what this project is, without re-deriving it from scratch each time.

## What this is

**Billionaire Brother** is an AI-powered strategic business auditing product. It watches revenue-critical web pages (landing pages, sales pages, SaaS pricing pages, checkout funnels) and gives founders/marketers an AI-generated audit: value proposition analysis, audience targeting, revenue leaks, copy weaknesses, legal/compliance risk, and recommended next moves.

It ships as **two coordinated repos**:

| Repo | Path | Role |
| --- | --- | --- |
| **Main web platform** | `C:\Users\spenc\projects\agentic-billionaire-brother` | Next.js web app: marketing site, dashboard, auth, billing, the AI backend/API that does the actual auditing |
| **Chrome extension** | `C:\Users\spenc\projects\bb-chrome-extension` | Manifest V3 browser extension — the in-browser client that extracts page content and talks to the main platform's API |

They are **one product split across two repos** — the extension is a client of the web platform's `/api/extension/*` routes. Treat changes that touch the extension↔backend contract as cross-repo changes.

## Main web platform (`agentic-billionaire-brother`)

- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase (`@supabase/ssr`, `@supabase/supabase-js`) for auth/DB, Stripe for billing, Amazon SES for email, Google GenAI/ADK (`@google/genai`, `@google/adk`) for the AI layer.
- **Deploy**: Vercel (`vercel.json`) and/or Firebase App Hosting (`apphosting.yaml`).
- **Structure**:
  - `src/app/` — App Router pages: `(admin)`, `(dashboard)`, `auth`, `beta`, `contact`, `guide`, legal pages (`privacy`, `terms`, `refunds`, `data-usage`, `delete-account`), plus SEO (`sitemap.ts`, `robots.ts`).
  - `src/app/api/` — backend routes, notably: `admin`, `auth`, `beta-testers`, `billing`, `board-meeting`, `chat`, `commit`, `cron`, `dashboard`, `email`, **`extension`** (the Chrome extension's backend), `giphy-search`, `interview`, `jobs`, `mcp`, `questionnaire`, `reset-strategy`, `revenue-tracking`, `revenue-wins`, `social`, `strategies`, `tasks`, `usage`, `webhooks`, `weekly-checkin`, `workers`.
  - `src/components/`, `src/lib/` — shared UI and backend utilities.
  - `src/proxy.ts` — request proxying.
- **Notable docs in repo root**: `billionaire_brother_mcp_documentation.pdf`, `mcp_api_prompt.md` (MCP integration for the AI), `website_map_documentation_BB.pdf`, `website handoff template.pdf`.
- This repo also contains agent-workspace scaffolding (`AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`) — an autonomous-agent persona setup layered on top of the product code. Don't confuse these with the product's own AI features.

## Chrome extension (`bb-chrome-extension`)

- **Purpose**: "Billionaire Brother Execution Engine" — injects into any active tab, extracts strategic page signals (headlines, hero copy, CTAs, pricing, FAQs, testimonials, forms), and sends them to the main platform for AI analysis, directly from a Chrome side panel.
- **Stack**: React 18 + TypeScript, bundled with esbuild (`build.mjs`), Manifest V3.
- **Structure** (`src/`):
  - `content/extract-page.ts` — DOM extraction content script.
  - `service-worker/index.ts` — MV3 background service worker (context menus, cookie/session checks, tab listeners).
  - `sidepanel/` — main React app (`App.tsx`), report exporter (PDF/text), styles.
  - `popup/` — the toolbar popup.
- **Backend integration**: talks to `thebillionairebrother.com` (or a local dev server via `bb_api_base` in Chrome storage) through:
  - `GET /api/extension/session` — auth/tier check (requires `brother` or `team` subscription tier)
  - `POST /api/extension/audit` — submit a page snapshot for auditing
  - `GET /api/extension/runs/[id]` — poll audit job status
  - These correspond to `src/app/api/extension/*` in the main repo.
- **Build/package commands**: `npm run build`, `npm run watch`, `npm run package` (produces `bb-extension.zip` for Chrome Web Store upload).
- Has its own compliance doc: `CHROME_WEB_STORE_COMPLIANCE.md`.

## Working across both repos

- If a task changes the shape of extension↔backend communication (session check, audit submission, run polling), check both `src/app/api/extension/*` (main repo) and `src/service-worker` / `src/sidepanel` (extension repo).
- The two repos are versioned and deployed independently (extension is packaged/zipped and uploaded to the Chrome Web Store separately from the web app's Vercel/Firebase deploy).
