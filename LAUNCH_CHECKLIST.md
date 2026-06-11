# DSober — Launch Checklist (remaining manual steps)

Everything in the audit that could be done in code/DB is committed on the
`release-readiness` branch. The items below need **your credentials, dashboard
access, or a decision**, so they're left for you. Do them in order.

---

## 1. Supabase production auth config (dashboard) — `P1.7`

Applied via the Management API already:

- [x] **Site URL** → `dsober://auth-callback`
- [x] **Redirect URLs** → `dsober://auth-callback`, `dsober://reset-password`,
      `dsober://*` (without these, confirmation/reset links can't return to the app).
- [x] **Leaked-password protection** → on (`password_hibp_enabled = true`).

Still to do — these two must land **together** (turning on confirmation without a
working sender breaks all signups):

- [ ] **Custom SMTP**: configure a real sender (e.g. Resend free tier). The default
      Supabase SMTP allows only ~2–3 emails/hour and **will throttle 50–100 signups**.
- [ ] **Confirm email** (`mailer_autoconfirm = false`): currently OFF so signups
      aren't blocked on un-sendable emails. Flip it in the same step as SMTP.
      (Give me SMTP creds + a fresh PAT and I'll do both in one call.)

## 2. Sentry crash reporting — `P2.3` (finish)

Sentry is wired but disabled until configured:

- [ ] Create a Sentry project, copy its DSN into `app.json` → `extra.sentryDsn`.
- [ ] In `app.json` → the `@sentry/react-native/expo` plugin, replace
      `REPLACE_WITH_SENTRY_ORG` / `REPLACE_WITH_SENTRY_PROJECT`.
- [ ] Set `SENTRY_AUTH_TOKEN` in the EAS build environment (for source maps):
      `eas secret:create --name SENTRY_AUTH_TOKEN --value <token>`.

## 3. TestFlight build + submit config — `P1.6`

Prereq: **Apple Developer Program** membership ($99/yr).

- [ ] Fill `eas.json` → `submit.production.ios`: `appleId`, `ascAppId`
      (App Store Connect app's numeric ID), `appleTeamId`.
- [ ] Host the **privacy policy** (drafted at `docs/privacy.html` — fill in the
      `[CLUB / ORGANIZATION NAME]` and `[CONTACT EMAIL]` placeholders) and put its
      URL in App Store Connect. Easiest host: GitHub Pages from `/docs`
      (Settings → Pages → Source: `main` / `/docs`). The data to declare in App
      Privacy: email, name, birthday, phone, **precise location**, **photos**
      (incl. driver's license), and **audio recordings**.
- [ ] App Store Connect → set **age rating 17+** (alcohol reference).
- [ ] Beta App Review info: provide a demo account + a short "what is SEP" note.
- [ ] Build & submit:
      ```bash
      eas build --platform ios --profile production
      eas submit --platform ios --profile production
      ```
- [ ] The production build automatically gets `aps-environment: production`
      (handled by EAS via CNG — no manual entitlement edit needed).

## 4. Launch day — wipe, rotate, ship — `P5` (STRICT ORDER)

1. [ ] **Regression test first**, using the existing seeded test accounts (see
       `dev-accounts.md`, gitignored). Run the full end-to-end flow on a device
       build before destroying any data.
2. [ ] **Wipe test data** (after regression passes). The 47 test auth users
       cascade-delete all their public rows; then remove the 4 seeded groups and
       any test storage objects. (I can run this for you on your go — it's
       destructive so I left it for explicit approval.)
3. [ ] **Create the real chapter** with a **brand-new access code** — the seeded
       codes (`ABG2024`, `KTP2024`, …) are committed in git history and burned.
4. [ ] **Rotate the service-role key** (Dashboard → Settings → API → roll
       `service_role`). Update your local `.env` and any EAS secret. The old key
       (`sb_secret_…`) was used by the seed scripts and should not outlive launch.
5. [ ] Invite TestFlight testers — internal first, then the external group link
       (the external link triggers Beta App Review, which needs step 3 above).

## 5. Ops notes

- [ ] If the project is on the Supabase **free tier**, it **pauses after ~1 week
      of inactivity** — upgrade to Pro before a real launch, or expect a cold
      start.
- [ ] First week: watch `get_advisors`, Supabase logs, and Sentry.

---

## What was already done (for reference)

- **Security (live DB):** blocked self-promotion to admin; removed the open
  `admin_alerts` INSERT; dropped the unauthenticated `manual_cleanup_dd_data`;
  revoked the RPC surface on all trigger/helper functions; restored the missing
  `ride_requests` RLS (the feature was silently broken in prod); blocked DD-request
  self-approval; locked group join behind a SECURITY DEFINER RPC so access codes
  aren't enumerable; made all four storage buckets private; authenticated the
  notification webhook with a Vault secret; pinned `search_path` on all functions.
- **App:** real account deletion (Apple requirement) via `delete-account` edge
  function; surfaced previously-swallowed mutation errors; AppState token refresh;
  full password-reset + email-confirmation deep-link flow; private-photo signed
  URLs; orphaned-ride guard on session end; Sentry; clean `tsc`.
- **Release:** adopted CNG (app.json is the single source of native config; fixed
  location permission strings, deduped background modes, added `dsober://` scheme).
- **DB hygiene:** consolidated duplicate RLS policies, wrapped `auth.uid()` for
  index-friendly RLS, added FK/composite indexes, re-baselined migrations and
  archived the destructive old chain.
