# DSober — Designated Driver Management Platform

A React Native (Expo) app for coordinating designated drivers in fraternities and
sororities, with a sobriety-verification (SEP) gate before a member can drive.

## Prerequisites

- Node.js v20.18.0+
- Expo CLI (`npx expo`)
- An iOS device or Simulator (the app is iOS-first; Android isn't fully configured)
- Access to the project's Supabase Cloud instance

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

The app reads its Supabase credentials from `app.json` → `expo.extra`
(`supabaseUrl`, `supabaseAnonKey`) for builds, falling back to a local `.env`
for development. Copy `.env.example` to `.env` and fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ybsinrajanwhabgivsvv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable anon key>
# server-side scripts only (never ship this in the app):
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

> The publishable anon key is safe in the client; the service-role key is a
> secret used only by the `scripts/` and edge functions — keep it out of git.

### 3. Database (Supabase Cloud only)

**This project uses Supabase Cloud exclusively — there is no local database.**
Do not run `supabase start` / `supabase db reset`.

- Project: `ybsinrajanwhabgivsvv` — https://supabase.com/dashboard/project/ybsinrajanwhabgivsvv
- Schema lives in `supabase/migrations/` (a single hardened baseline; older
  numbered migrations are archived under `supabase/migrations/_archive/`).
- Edge functions: `send-notification` (push fan-out, webhook-secret gated) and
  `delete-account` (account deletion). Deploy with `supabase functions deploy <name>`.

Helper commands:

```bash
./scripts/db-helper.sh status      # migration status
./scripts/db-helper.sh dashboard   # open the dashboard
./scripts/db-helper.sh sql         # open the SQL editor
```

### 4. Run

```bash
npm start            # Expo dev server (dev client)
npm run ios          # build & run on iOS
```

Native projects (`ios/`, `android/`) are **generated** by Expo prebuild (CNG)
and are not committed — `app.json` is the single source of truth for native
config. Run `npx expo prebuild -p ios` if you need the native project locally.

## Distribution (iOS / TestFlight)

Builds are produced with EAS (`eas build -p ios --profile production`) and
submitted to TestFlight (`eas submit -p ios`). See `eas.json` for profiles.
Crash reporting uses Sentry — set `extra.sentryDsn` in `app.json` and the
`@sentry/react-native/expo` plugin's `organization`/`project` before a
production build (it stays disabled until a DSN is provided).

## Project structure

```
DSober/
├── App.tsx                  # entry point (Sentry-wrapped)
├── lib/supabase.ts          # Supabase client + auth refresh
├── lib/sentry.ts            # crash reporting (no-op until DSN set)
├── contexts/                # Auth + Notification providers
├── navigation/              # root + onboarding + DD-upgrade navigators
├── screens/                 # app screens (+ onboarding/)
├── components/ui/           # shared UI primitives
├── utils/                   # storage, mappers, notifications, sep, eventStatus
├── supabase/functions/      # edge functions
└── supabase/migrations/     # cloud schema (baseline; older in _archive/)
```

## Features

- Email/password auth with confirmation + password reset (deep-linked)
- Multi-step onboarding with SEP baseline (reaction, phrase, selfie)
- Chapter join by access code (server-side, codes are not enumerable)
- Event creation, DD requests/approvals, DD assignments
- SEP verification gate before each DD session
- Active-DD discovery and ride request → accept → pickup → complete flow
- Push notifications for every step
- Admin dashboard (DD approvals, SEP-failure alerts)
- Account deletion (full data erasure)
