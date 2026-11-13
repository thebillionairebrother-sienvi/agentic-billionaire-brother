# BFCM 2026 trial — step-by-step setup

**Offer:** Brother Plan, one full month free from each sign-up, card required,
then $49.00 USD/month. Sign-ups close **2026-11-30 23:59 PST** (first rejected
instant `2026-12-01T08:00:00Z`). Outside the offer: $39 first month, then $49/month.
Team plan: "coming soon", checkout off.

Each step says **who** does it. "Claude" steps need the "You" steps above them first.

---

## Status (2026-11-13)
- ✅ Migration applied (via Supabase web SQL editor)
- ✅ Stripe CLI logged in; test-mode BB product, $49 price and $39 coupon created
- ✅ Local test-mode QA passed (see Phase 4) — test accounts deleted afterwards
- ✅ Live Stripe: $49/mo price (`bb_brother_monthly_4900`) + `bb-brother-first-month-39` coupon created
- ✅ Live webhook `we_1UbFP2Dnw1azoLSph1W2P8rl` (mybillionairebrother.com, 8 events, API 2026-01-28.clover); old endpoint `we_1THmbcDnw1azoLSpmkTHkogT` disabled, kept for rollback
- ✅ Firebase secrets created + backend access granted: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BILLING_LINK_SECRET`, `CRON_SECRET`; `NEXT_PUBLIC_APP_URL` set in `apphosting.yaml`
- ✅ App Hosting console env checked: AWS SES vars present; price ids / publishable key not needed
- ⚠️ Console `NEXT_PUBLIC_APP_URL` = `https://www.billionairebrother.com` (dead domain) overrides `apphosting.yaml` — change it (see [BFCM_2026_TODO.md](BFCM_2026_TODO.md))
- ⛔ **Gemini API credits are depleted** (`402 RESOURCE_EXHAUSTED` during the onboarding interview). Top up in AI Studio before launch — trial users can't use Derek otherwise.

## Phase 0 — Unblock (today)

### 0.1 Pay the Supabase invoice — You (urgent)
Supabase failed to charge the **Sienvi** org for invoice `QIRXNW-00006` ($28.00) on
Nov 12 and warned of a **pending shutdown**. If BB's database is in that org, a
shutdown takes the whole site down (login, chat, billing).
1. Open the email "[Supabase] Action Required: Payment Failure And Pending Shutdown" (info@sienvi.com).
2. Click **Update Payment Method** (org billing page) → add a working card, or use the direct-pay link in the email.
3. In the Supabase dashboard, open project `nejesuhdrjeeghryjmiz` and check which org it belongs to.

### 0.2 Log the Supabase CLI into the account that owns BB — ✅ not needed (migration applied in the web SQL editor)
The CLI is currently logged into the CheerCPT account, which can't see BB's project.
```
! npx supabase logout
! npx supabase login
```
Sign in with the account that owns project `nejesuhdrjeeghryjmiz` (likely info@sienvi.com).

### 0.3 Log the Stripe CLI into the Sienvi Stripe account — ✅ done
```
! stripe login
```
Approve the pairing code in the browser. This gives test-mode keys (no real money) and lets
Claude forward test webhooks to the local server.

---

## Phase 1 — Database + local test (Claude, after Phase 0)

### 1.1 Apply the migration — Claude
```
npx supabase link --project-ref nejesuhdrjeeghryjmiz
npx supabase db query --linked -f supabase/migrations/20261113_bfcm_trial_billing.sql
```
(Not `db push` — that would try to re-run every old migration.) Pre-checked: all 21 users have
`subscription_status = 'none'`, so the new CHECK constraint applies cleanly.

### 1.2 Create Stripe **test-mode** prices — Claude
`node scripts/stripe-setup-brother-pricing.mjs --env .env.stripe-test --apply`

### 1.3 Local end-to-end test — Claude
- Second dev server on port 3001 with **test** Stripe keys (your :3000 server uses the LIVE key; don't
  click through checkout there).
- `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
- A dedicated test account (e.g. `bb-trial-test+1@…`) in the production database, deleted afterwards.
- Stripe Test Clocks to fast-forward: trial → reminder → $49 renewal; cancel → free; failed card → free.
- Screenshots + DB/Stripe evidence for every path in Phase 4.

---

## Phase 2 — Production configuration (You, with Claude guiding)

### 2.1 Firebase App Hosting access — ✅ done
CLI logged in as yourbro@thebillionairebrother.com. Project `the-billionaire-brother`,
backend `agentic-billionaire-brother` (us-east4, deploys from GitHub).
`apphosting.yaml` on this branch now references `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`BILLING_LINK_SECRET` and `CRON_SECRET` — **create all four secrets (2.5) before merging**, or the build fails.
Check the Firebase console (App Hosting → backend → Settings → Environment) that
`STRIPE_PRICE_ID_BROTHER`, `STRIPE_PRICE_ID_TEAM`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_APP_URL` and the AWS SES variables are already set there.

### 2.2 Production Stripe objects — You approve, Claude runs
`node scripts/stripe-setup-brother-pricing.mjs --apply` (live) → $49/mo price + $39-first-month coupon.

### 2.3 Live webhook endpoint — You (Stripe dashboard → Developers → Webhooks)
Edit `https://mybillionairebrother.com/api/webhooks/stripe` (or add one for thebillionairebrother.com)
and select these events:
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`,
`invoice.payment_succeeded`, `invoice.payment_failed`. Copy its **signing secret**.

### 2.4 Other Sienvi webhooks — You
Two Supabase functions on the shared Stripe account also receive `checkout.session.completed`
(`ouxnqgwdwccjipmplure…/stripe-webhook`, `jdodjbzypuiyhgrzuyzp…/stripe-webhook`). Ask their owner to
confirm they ignore events with `metadata.app = "bb"`, so BB sign-ups don't trigger agency actions.

### 2.5 Environment variables + secrets — You (Claude can run the commands once 2.1 is done)
Production currently has **no Stripe key** — the original reason checkout never worked.
Secrets: `firebase apphosting:secrets:set NAME`, then reference them in `apphosting.yaml`.

| Variable | Type | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | secret | live `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | secret | from 2.3 |
| `STRIPE_PRICE_ID_BROTHER` / `STRIPE_PRICE_ID_TEAM` | plain | same as `.env.local` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | plain, BUILD + RUNTIME | `pk_live_…` |
| `NEXT_PUBLIC_APP_URL` | plain, BUILD + RUNTIME | `https://thebillionairebrother.com` |
| `BILLING_LINK_SECRET` | secret | 32+ random chars (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — reminders fail without it |
| `CRON_SECRET` | secret | 32+ random chars (same value goes into GitHub in 2.6) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | secret | SES credentials |
| `AWS_REGION`, `AWS_SES_FROM_EMAIL` | plain | from-address must be a verified SES identity |
| `NEXT_PUBLIC_BFCM_STARTS_AT` | plain, BUILD + RUNTIME | optional — only to change the Nov 19 00:00 PST launch time |
| `BETA_PROGRAM_ENDS_AT` | plain | optional — default `2026-11-20T08:00:00Z` |

### 2.6 Hourly reminder job — You (GitHub repo admin)
The workflow `.github/workflows/trial-reminders.yml` replaces Cloud Scheduler.
Repo → Settings → Secrets and variables → Actions:
- **Secret** `CRON_SECRET` = same value as 2.5
- **Variable** `APP_URL` = `https://thebillionairebrother.com`
Then Actions → "Trial reminders (hourly)" → **Run workflow** once; expect HTTP 200.

### 2.7 Deploy — You
Merge the PR → App Hosting builds → smoke test:
- `/offer` shows $49.00 and a date one month out
- `curl -X POST https://<domain>/api/webhooks/stripe` must **not** return `"mode":"test"`

---

## Phase 3 — Beta end (≈ Nov 20, after launch)
1. `node scripts/end-beta-program.mjs` (dry run) — Claude runs, you review the list.
2. `node scripts/end-beta-program.mjs --apply` — you approve.
   Keeps 5 admins (teamsienvi, spenceralmodiel, scott@sienvi.com, yourbro@, info@sienvi.com) and anyone
   with a Stripe trial/subscription; moves the remaining comped users to Free; grants the admin role.
   Beta codes stop working automatically on `BETA_PROGRAM_ENDS_AT`.

---

## Phase 4 — QA evidence (Claude, test mode)
- [ ] New user → `/offer` → consent → card `4242…` → trial active, tier `brother`, enrollment `active`
- [ ] Abandon checkout / no card → stays on free plan, nothing charged
- [ ] Double click → same Checkout Session; second enrollment refused
- [ ] Admin / existing subscriber / prior-trial user → refused with the right message
- [ ] Cutoff: 07:59:59Z Dec 1 accepted, 08:00:00Z rejected (unit tests + live API check)
- [ ] Test clock −7 days → reminder email sent once; cancel link works without login
- [ ] Cancel → access until trial end → tier `free`, $0 charged
- [ ] Trial end → $49.00 invoice paid → enrollment `converted`
- [ ] Card `4000 0000 0000 0341` → `past_due` banner → +7 days → cron cancels → tier `free`
- [ ] Remove card during trial → trial end cancels, no charge
- [ ] Outside offer: Brother checkout → first invoice $39.00, next $49.00
- [ ] Desktop + mobile screenshots: `/offer` (logged in), `/trial/cancel`, dashboard status bar

## Rollback
- Pause promotion; set `NEXT_PUBLIC_BFCM_STARTS_AT` to a future date and redeploy to close `/offer`.
- Code rollback = revert the merge; the migration is additive and can stay.
- Existing trials keep running in Stripe; cancel them in bulk only if instructed.

## Security notes (repo is public)
The beta codes, the geofence bypass key (`DEFAULT_BYPASS_KEY` in `geo-bot.ts`) and the admin email
list are visible to anyone on GitHub. Beta codes stop working on Nov 20; consider moving the bypass
key to an env var only.
