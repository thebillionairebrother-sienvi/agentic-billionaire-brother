# BFCM 2026: your to-do list

Steps only you can do before the Nov 19 launch, in order. Full background is in
[BFCM_2026_LAUNCH_CHECKLIST.md](BFCM_2026_LAUNCH_CHECKLIST.md).
Last checked: 2026-11-13.

## Before merging the PR

- [ ] **1. Pay the Supabase invoice** (urgent).
  The Sienvi org's invoice `QIRXNW-00006` ($28) failed on Nov 12, and Supabase warned it may shut the account down.
  Open the email "[Supabase] Action Required: Payment Failure And Pending Shutdown" (info@sienvi.com) → **Update Payment Method**.
  If BB's database (`nejesuhdrjeeghryjmiz`) is in that org, a shutdown takes the whole site down.

- [ ] **2. Top up Gemini API credits.**
  The key returns `402 RESOURCE_EXHAUSTED`, so Derek can't answer anyone. Use Google AI Studio → Billing for the key set as `GEMINI_API_KEY` in App Hosting.

- [ ] **3. Fix `NEXT_PUBLIC_APP_URL` in the Firebase console.**
  Firebase console → App Hosting → `agentic-billionaire-brother` → **Settings → Environment**.
  - It's currently `https://www.billionairebrother.com`. That domain doesn't serve the app (its TLS connection fails).
  - Change it to **`https://thebillionairebrother.com`** and save.
  - Values set in the console override `apphosting.yaml`. Without this change, Stripe sends paying users back to a dead domain and the reminder email's cancel link breaks.
  - It also fixes the X/Twitter connect callback, which uses the same variable.

- [ ] **4. Add the GitHub secret and variable for the hourly reminder job.**
  The account `thebillionairebrother-sienvi` (logged into the gh CLI) is a repo admin. From the project folder, run:
  ```
  ! powershell -c "(Get-Content .env.github-cron-secret -Tail 1).Trim() | gh secret set CRON_SECRET -R thebillionairebrother-sienvi/agentic-billionaire-brother"
  ! gh variable set APP_URL -R thebillionairebrother-sienvi/agentic-billionaire-brother --body "https://thebillionairebrother.com"
  ```
  Or do it on the web: repo → **Settings → Secrets and variables → Actions**.
  - **Secrets** tab: add `CRON_SECRET` with the last line of `.env.github-cron-secret`.
  - **Variables** tab: add `APP_URL` = `https://thebillionairebrother.com`.

  Check with `gh secret list` / `gh variable list`, then delete `.env.github-cron-secret`.

- [ ] **5. Ask the owner of the other two Sienvi Stripe webhooks** to confirm they ignore events where `metadata.app = "bb"`.
  The two Supabase functions (`ouxnqgwd…/stripe-webhook` and `jdodjbzy…/stripe-webhook`) share the Stripe account and also receive `checkout.session.completed`.

Already in place (nothing to do):
- AWS SES variables in App Hosting: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_FROM_EMAIL`.
- Stripe live price and coupon.
- New webhook endpoint.
- The four Firebase secrets.

`STRIPE_PRICE_ID_*` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are **not** needed: checkout finds the price by lookup key and uses Stripe's hosted page.

## Merge and deploy

- [ ] **6. Review and merge the PR** (`feat/bfcm-trial` → `master`). App Hosting builds automatically.
- [ ] **7. Smoke test** after the rollout finishes:
  - `curl -X POST https://thebillionairebrother.com/api/webhooks/stripe` → should **not** contain `"mode":"test"`.
  - `/offer` shows $49.00/month and a first-charge date one month out (before Nov 19 it says the offer hasn't started).
  - GitHub → **Actions → "Trial reminders (hourly)" → Run workflow** → finishes green.
- [ ] **8. Do one real checkout yourself** with a card, on a test account.
  This is the one step Claude couldn't automate, because Stripe's hosted page blocks bots.
  - Confirm the dashboard shows the trial.
  - Then cancel from **Settings → Manage billing** so you aren't charged.

## After launch

- [ ] **9. Nov 20: end the beta program.**
  Claude runs `node scripts/end-beta-program.mjs` as a dry run. You review the list, then approve `--apply`.
  It keeps the 5 admins and any Stripe subscribers.
- [ ] **10. Optional security clean-up (the repo is public).**
  Move the geofence bypass key (`DEFAULT_BYPASS_KEY` in `src/lib/security/geo-bot.ts`) to an env var and change it.
  Beta codes stop working on their own on Nov 20.

## Rollback

If something goes wrong:
- **Close the offer:** set `NEXT_PUBLIC_BFCM_STARTS_AT` to a future date in App Hosting and redeploy.
- **Undo the code:** revert the merge. The database migration can stay.
- **Old Stripe webhook:** `we_1THmbc…` is disabled but kept. Re-enable it in the Stripe dashboard if needed.
