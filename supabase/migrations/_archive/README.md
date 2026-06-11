# Archived migrations

These are the original numbered migrations `000`–`037` plus the two
`20260416…` seed migrations. They are **archived and must not be replayed**:

- `000_reset_database.sql` **drops every table** (`DROP TABLE … CASCADE`).
- `012_set_test_phone_numbers.sql` **overwrites every user's phone number**
  with one test number.
- The seed migrations insert test groups whose access codes are now public
  (committed), so they are burned and were wiped before launch.

## Current source of truth

The live Supabase Cloud project `ybsinrajanwhabgivsvv` is authoritative.
All security hardening (RLS rewrites, dropped functions, notification webhook
auth, private storage buckets, performance indexes) was applied directly to it
and captured as the single active migration:

    supabase/migrations/20260611012818_hardened_baseline.sql

That baseline is a schema-only `pg_dump` of the hardened `public` + `storage`
schemas. Use it to provision a **fresh** project or for disaster recovery — do
**not** `supabase db push` it against the live project (its objects already
exist there; the remote migration-history table still records this archived
chain).

## Not captured by the schema dump (live-state / out-of-band config)

When recreating on a fresh project, also reapply:

1. **Storage bucket privacy** — `license-photos`, `sep-selfies`, `sep-audio`,
   `profile-photos` are all `public = false`.
2. **Vault secret** `notify_webhook_secret` (consumed by `private.notify_secret()`),
   and the matching edge-function env var `NOTIFY_WEBHOOK_SECRET`.
3. **`auth.users` email trigger** `on_auth_user_email_updated → public.handle_user_email_update()`
   (lives in the `auth` schema, which `db dump` does not export).
4. **Edge functions** in `supabase/functions/` (`send-notification`, `delete-account`)
   — deploy with `supabase functions deploy`; `send-notification` runs with
   `verify_jwt = false` (it authenticates via the webhook secret).
