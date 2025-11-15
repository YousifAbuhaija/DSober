# Supabase Setup Troubleshooting

## Common Issues and Solutions

### Issue: "infinite recursion detected in policy for relation 'users'"

**Cause:** The RLS policies have circular dependencies where the `users` table policies query the `users` table itself.

**Solution:**

1. Run the reset script to clean up:
   ```sql
   -- In Supabase SQL Editor, run:
   -- migrations/000_reset_database.sql
   ```

2. Apply the corrected migrations in order:
   ```sql
   -- Step 1: migrations/001_initial_schema_v2.sql
   -- Step 2: migrations/003_fix_rls_policies.sql
   -- Step 3: migrations/002_storage_setup.sql
   ```

3. Verify with: `npm run verify-db`

---

### Issue: Storage buckets not found

**Cause:** Storage bucket creation via SQL might fail in some Supabase versions.

**Solution - Manual Creation:**

1. Go to **Storage** in Supabase dashboard
2. Click **New Bucket** and create each bucket:

   **Bucket 1: license-photos**
   - Name: `license-photos`
   - Public: ❌ No
   - File size limit: 5242880 (5MB)
   - Allowed MIME types: `image/jpeg`, `image/png`

   **Bucket 2: sep-selfies**
   - Name: `sep-selfies`
   - Public: ❌ No
   - File size limit: 2097152 (2MB)
   - Allowed MIME types: `image/jpeg`, `image/png`

   **Bucket 3: sep-audio**
   - Name: `sep-audio`
   - Public: ❌ No
   - File size limit: 1048576 (1MB)
   - Allowed MIME types: `audio/mp4`, `audio/mpeg`, `audio/x-m4a`

3. Then run the storage policies from `migrations/002_storage_setup.sql`

---

### Issue: "relation already exists" errors

**Cause:** Tables were already created from a previous migration attempt.

**Solution:**

Either:
- **Option A:** Ignore the errors if tables are correct (check with verification script)
- **Option B:** Run the reset script and start fresh:
  ```sql
  -- migrations/000_reset_database.sql
  ```

---

### Issue: Verification script shows "Module type not specified" warning

**Cause:** Node.js warning about ES modules vs CommonJS.

**Solution:**

This is just a warning and doesn't affect functionality. To eliminate it:

1. Add to `package.json`:
   ```json
   {
     "type": "module"
   }
   ```

2. Or ignore it - the script still works correctly.

---

### Issue: "Missing Supabase credentials" when running verify-db

**Cause:** Environment variables not set or `.env` file not found.

**Solution:**

1. Ensure `.env` file exists in project root
2. Check it contains:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Verify the values are correct (no quotes, no extra spaces)
4. Restart your terminal/IDE after changing `.env`

---

### Issue: RLS policies preventing data access

**Cause:** Policies are too restrictive or user doesn't have required data (e.g., no group_id).

**Solution:**

1. **Check user has group_id:**
   ```sql
   SELECT id, email, group_id, role FROM users WHERE id = auth.uid();
   ```

2. **Temporarily disable RLS for testing (NOT for production):**
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   -- Test your queries
   -- Then re-enable:
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ```

3. **Check policy logic:**
   - View policies in **Authentication → Policies**
   - Ensure helper functions exist: `public.get_user_group_id()` and `public.is_user_admin()`

---

### Issue: Helper functions not found

**Cause:** Migration 003 wasn't run or failed.

**Solution:**

1. Check if functions exist:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('get_user_group_id', 'is_user_admin');
   ```

2. If missing, run `migrations/003_fix_rls_policies.sql` again

---

### Issue: Seed data not loading

**Cause:** Groups table already has data or constraint violation.

**Solution:**

1. Check existing groups:
   ```sql
   SELECT * FROM groups;
   ```

2. If empty, manually insert:
   ```sql
   INSERT INTO groups (name, access_code) VALUES
     ('Alpha Beta Gamma', 'ABG2024'),
     ('Delta Epsilon Zeta', 'DEZ2024'),
     ('Theta Kappa Lambda', 'TKL2024');
   ```

---

### Issue: Can't create user during signup

**Cause:** User record not created in `users` table after auth signup.

**Solution:**

1. **Check trigger exists:**
   ```sql
   SELECT trigger_name FROM information_schema.triggers 
   WHERE event_object_table = 'users';
   ```

2. **Manually create user record after signup:**
   ```sql
   INSERT INTO users (id, email, name, birthday, gender)
   VALUES (
     'user-uuid-from-auth',
     'user@example.com',
     'User Name',
     '2000-01-01',
     'prefer-not-to-say'
   );
   ```

3. **Or create a trigger to auto-create user records** (advanced)

---

## Migration Order Reference

### Fresh Setup (Recommended)
```
1. 001_initial_schema_v2.sql  ← Tables, indexes, triggers
2. 003_fix_rls_policies.sql   ← RLS policies (fixed)
3. 002_storage_setup.sql      ← Storage buckets
```

### Reset and Rebuild
```
1. 000_reset_database.sql     ← ⚠️ Deletes everything
2. 001_initial_schema_v2.sql
3. 003_fix_rls_policies.sql
4. 002_storage_setup.sql
```

### Old Setup (Has Issues - Don't Use)
```
❌ 001_initial_schema.sql  ← Has circular RLS policies
```

---

## Verification Checklist

After running migrations, verify:

- [ ] All 9 tables exist (run `npm run verify-db`)
- [ ] All 3 storage buckets exist
- [ ] Seed data loaded (3 groups)
- [ ] Helper functions exist (`public.get_user_group_id`, `public.is_user_admin`)
- [ ] RLS enabled on all tables
- [ ] Can sign up a new user
- [ ] Can join a group with access code

---

## Getting Help

1. **Check Supabase logs:**
   - Go to **Logs** in dashboard
   - Look for errors during queries

2. **Test queries directly:**
   - Use SQL Editor to test queries
   - Check what data exists

3. **Verify RLS policies:**
   - Go to **Authentication → Policies**
   - Check each table has policies

4. **Check documentation:**
   - [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
   - [Supabase Storage Guide](https://supabase.com/docs/guides/storage)

---

## Quick Fixes

### Reset Everything
```sql
-- Run in SQL Editor
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then run migrations 001_v2, 003, 002
```

### Check What Exists
```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- List all policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- List all storage buckets
SELECT * FROM storage.buckets;
```

### Test RLS as User
```sql
-- Set session to act as a specific user
SET request.jwt.claim.sub = 'user-uuid-here';

-- Test query
SELECT * FROM users WHERE id = 'user-uuid-here';

-- Reset
RESET request.jwt.claim.sub;
```
