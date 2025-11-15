# Quick Fix for "Infinite Recursion" Error

You're seeing this error because the RLS policies have circular dependencies. Here's how to fix it:

## Solution (5 minutes)

### Step 1: Reset the Database

1. Open Supabase SQL Editor
2. Copy and paste this entire file: `migrations/000_reset_database.sql`
3. Click **Run**
4. Wait for "Success" message

⚠️ **Warning:** This deletes all existing data. If you have important data, back it up first.

### Step 2: Create Tables

1. In SQL Editor, click **New Query**
2. Copy and paste this entire file: `migrations/001_initial_schema_v2.sql`
3. Click **Run**
4. Wait for "Success" message

✅ This creates all tables, indexes, triggers, and seed data.

### Step 3: Apply Fixed RLS Policies

1. In SQL Editor, click **New Query**
2. Copy and paste this entire file: `migrations/003_fix_rls_policies.sql`
3. Click **Run**
4. Wait for "Success" message

✅ This creates RLS policies without circular dependencies.

### Step 4: Create Storage Buckets

1. In SQL Editor, click **New Query**
2. Copy and paste this entire file: `migrations/002_storage_setup.sql`
3. Click **Run**
4. Wait for "Success" message

✅ This creates storage buckets and policies.

**If storage buckets fail:** Create them manually via Storage dashboard (see TROUBLESHOOTING.md).

### Step 5: Verify

Run the verification script:

```bash
npm run verify-db
```

You should see:
- ✅ All 9 tables present
- ✅ All 3 storage buckets present (or create manually)
- ✅ Seed data loaded

## What Was Fixed?

The original migration had RLS policies that queried the `users` table from within `users` table policies, causing infinite recursion:

```sql
-- ❌ OLD (causes recursion)
CREATE POLICY "Users can read other users in their group"
  ON users FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM users WHERE id = auth.uid())
    --                              ^^^^^ queries users table from users policy!
  );
```

The fix uses helper functions in the `public` schema to break the circular dependency:

```sql
-- ✅ NEW (no recursion)
CREATE FUNCTION public.get_user_group_id() RETURNS UUID AS $$
  SELECT group_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE POLICY "Users can read users in same group"
  ON users FOR SELECT
  USING (group_id = public.get_user_group_id());
  --                ^^^^^^^^^^^^^^^^^^^^^^^^^^^ uses function, no recursion!
```

**Note:** Functions are created in `public` schema (not `auth`) because Supabase doesn't allow custom functions in the `auth` schema.

## Test Access Codes

After setup, test with these access codes:
- `ABG2024` - Alpha Beta Gamma
- `DEZ2024` - Delta Epsilon Zeta
- `TKL2024` - Theta Kappa Lambda

## Need Help?

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions to common issues.
