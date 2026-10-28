# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Companion Chrome extension

This Next.js app is also the backend for the BB Chrome extension, which lives in a sibling repo: `C:\Users\spenc\projects\bb-chrome-extension` (it has its own `CLAUDE.md`). The two ship together, so treat changes to the extension's surface here as cross-repo changes.

- **API routes:** `src/app/api/extension/` (`audit`, `chat`, `history`, `runs/[id]`, `session`, `telemetry`). The extension calls these from `https://thebillionairebrother.com` (or `http://localhost:3000` in its dev mode) with `credentials: 'include'`, so it relies on the website's cookie-based Supabase session. Request/response shapes, error messages, and tier gating (`brother`/`team`) must stay in sync with the extension's hooks in `src/sidepanel/hooks/`, so read the matching extension code before changing a route's contract.
- **Website pages the extension opens:** `/auth`, `/auth?mode=signup`, `/upgrade`, `/#pricing`, and `/extension/uninstalled` (the service worker's uninstall URL). Changing or moving these routes breaks links in the extension.

## Geofencing

`src/proxy.ts` blocks visitors outside the allowed countries and redirects them to `/region-restricted`; the logic is in `src/lib/security/geo-bot.ts`.

- The allowed-country list is duplicated in three places that must be kept in sync: `ALLOWED_COUNTRIES` in `src/lib/security/geo-bot.ts`, `src/components/security/GeoGuardian.tsx`, and `src/components/analytics/AnalyticsGate.tsx`. `scratch/test-geo-bot.ts` (`npx tsx scratch/test-geo-bot.ts`) asserts which countries are allowed.
- `isExemptRoute` skips the geofence for `/api/extension/*`, so the extension's API calls work from any country. The website pages above (`/auth`, `/upgrade`, `/extension/uninstalled`) are **not** exempt, so extension users in a blocked country can't sign in, sign up, or upgrade.
