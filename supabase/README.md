# Supabase Database Setup

This directory contains SQL migration files to set up the complete DSober database schema.

## Quick Setup

### Option 1: Using Supabase Dashboard (Recommended for MVP)

**If this is your first time setting up:**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run migrations in this order:
   - **Step 1:** Copy and paste `migrations/001_initial_schema_v2.sql` → Click **Run**
   - **Step 2:** Copy and paste `migrations/003_fix_rls_policies.sql` → Click **Run**
   - **Step 3:** Copy and paste `migrations/002_storage_setup.sql` → Click **Run**

**If you already ran the old migrations and have errors:**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run migrations in this order:
   - **Step 1:** Copy and paste `migrations/000_reset_database.sql` → Click **Run** (⚠️ This deletes all data!)
   - **Step 2:** Copy and paste `migrations/001_initial_schema_v2.sql` → Click **Run**
   - **Step 3:** Copy and paste `migrations/003_fix_rls_policies.sql` → Click **Run**
   - **Step 4:** Copy and paste `migrations/002_storage_setup.sql` → Click **Run**

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Initialize Supabase in your project (if not already done)
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## What Gets Created

### Tables
- `groups` - Fraternity/sorority organizations
- `users` - User profiles and information
- `events` - Social events requiring DDs
- `dd_requests` - Requests to be a DD for an event
- `dd_assignments` - Approved DD assignments
- `sep_baselines` - User baseline measurements
- `sep_attempts` - SEP verification attempts
- `dd_sessions` - Active DD sessions
- `admin_alerts` - Alerts for admins

### Storage Buckets
- `license-photos` - Driver license photos (5MB limit)
- `sep-selfies` - SEP verification selfies (2MB limit)
- `sep-audio` - SEP phrase recordings (1MB limit)

### Security
- Row Level Security (RLS) enabled on all tables
- Comprehensive policies for user and admin access
- Storage policies for secure file access

### Seed Data
Three test groups are created with access codes:
- Alpha Beta Gamma: `ABG2024`
- Delta Epsilon Zeta: `DEZ2024`
- Theta Kappa Lambda: `TKL2024`

## Verification

After running the migrations, verify the setup:

1. **Check Tables**: Go to Table Editor and confirm all 9 tables exist
2. **Check Storage**: Go to Storage and confirm all 3 buckets exist
3. **Check RLS**: Go to Authentication → Policies and verify policies are active
4. **Test Seed Data**: Query the `groups` table to see the test groups

```sql
SELECT * FROM groups;
```

## Troubleshooting

### Migration Fails
- Ensure you're running migrations in order (001 before 002)
- Check that you have proper permissions in your Supabase project
- Look for error messages in the SQL Editor output

### Storage Buckets Not Created
- Storage bucket creation might require manual creation via Dashboard
- Go to Storage → New Bucket and create them manually if needed
- Then run just the storage policies from `002_storage_setup.sql`

### RLS Policies Not Working
- Verify RLS is enabled on each table
- Check that policies are created without errors
- Test with a real user account to verify access

## Next Steps

After successful setup:
1. Update your `.env` file with Supabase credentials
2. Test authentication by signing up a new user
3. Test joining a group with one of the seed access codes
4. Proceed with implementing the remaining tasks

## Schema Modifications

If you need to modify the schema:
1. Create a new migration file: `003_your_change.sql`
2. Add your ALTER TABLE or other SQL statements
3. Run the new migration
4. Document the changes in this README
