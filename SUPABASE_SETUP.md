# Supabase Setup Guide

This guide will help you set up your Supabase backend for the DSober application.

## Quick Start

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in the project details:
   - Name: DSober
   - Database Password: (choose a strong password and save it)
   - Region: (choose closest to your location)
5. Wait for the project to be created (takes ~2 minutes)

### 2. Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings → API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")
3. Update your `.env` file with these values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run Database Migrations

The complete database schema is provided in SQL migration files. Follow these steps:

#### Step 1: Create Tables, Indexes, and Triggers

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open the file `supabase/migrations/001_initial_schema_v2.sql`
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Wait for confirmation that the query executed successfully

This creates:
- All 9 database tables
- Foreign key relationships
- Indexes for performance
- Triggers for automatic timestamps
- Seed data (3 test groups)
- RLS enabled (policies added in next step)

#### Step 2: Apply RLS Policies

1. In the SQL Editor, click **New Query**
2. Open the file `supabase/migrations/003_fix_rls_policies.sql`
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run**
5. Wait for confirmation

This creates:
- Helper functions to avoid circular dependencies
- Row Level Security (RLS) policies for all tables
- Proper access control for users and admins

#### Step 3: Create Storage Buckets

1. In the SQL Editor, click **New Query**
2. Open the file `supabase/migrations/002_storage_setup.sql`
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run**
5. Wait for confirmation

This creates:
- 3 storage buckets (license-photos, sep-selfies, sep-audio)
- Storage access policies

**Note:** If storage buckets fail to create, see the [Troubleshooting Guide](supabase/TROUBLESHOOTING.md#issue-storage-buckets-not-found) for manual creation steps.

### 4. Verify Setup

Run the verification script to confirm everything is set up correctly:

```bash
npm install dotenv ts-node --save-dev
npx ts-node scripts/verify-database.ts
```

You should see:
- ✅ All 9 tables present
- ✅ All 3 storage buckets present
- ✅ Seed data loaded (3 groups)

### 5. Test Access Codes

Three test groups are automatically created with these access codes:

| Group Name | Access Code |
|------------|-------------|
| Alpha Beta Gamma | `ABG2024` |
| Delta Epsilon Zeta | `DEZ2024` |
| Theta Kappa Lambda | `TKL2024` |

Use these codes when testing the group join flow in the app.

## What Gets Created

### Database Tables

1. **groups** - Fraternity/sorority organizations
2. **users** - User profiles and information (extends auth.users)
3. **events** - Social events requiring DDs
4. **dd_requests** - Requests to be a DD for an event
5. **dd_assignments** - Approved DD assignments
6. **sep_baselines** - User baseline measurements
7. **sep_attempts** - SEP verification attempts
8. **dd_sessions** - Active DD sessions
9. **admin_alerts** - Alerts for admins

### Storage Buckets

1. **license-photos** - Driver license photos (5MB limit, private)
2. **sep-selfies** - SEP verification selfies (2MB limit, private)
3. **sep-audio** - SEP phrase recordings (1MB limit, private)

### Security Features

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access data in their group
- ✅ Admins have elevated permissions for their group
- ✅ Storage files are private with user-scoped access
- ✅ Automatic email sync from auth.users

## Detailed Schema

For complete schema details, see:
- `supabase/migrations/001_initial_schema.sql` - Full table definitions
- `supabase/README.md` - Migration documentation
- `.kiro/specs/dsober-dd-management/design.md` - Design document

## Troubleshooting

### Common Issues

**"infinite recursion detected in policy for relation 'users'"**
- You ran the old migration file. See [Troubleshooting Guide](supabase/TROUBLESHOOTING.md#issue-infinite-recursion-detected-in-policy-for-relation-users)
- Solution: Run `000_reset_database.sql` then the correct migrations

**Storage buckets not found**
- Create them manually via dashboard. See [Troubleshooting Guide](supabase/TROUBLESHOOTING.md#issue-storage-buckets-not-found)

**Verification script fails**
- Check `.env` file has correct credentials
- See [Troubleshooting Guide](supabase/TROUBLESHOOTING.md) for detailed solutions

**For complete troubleshooting help, see:** [supabase/TROUBLESHOOTING.md](supabase/TROUBLESHOOTING.md)

## Manual Setup (Alternative)

If you prefer to create tables manually:

1. Go to **Table Editor** in Supabase dashboard
2. Click **New Table** for each table
3. Add columns according to the schema in `001_initial_schema.sql`
4. Set up foreign keys in the table settings
5. Go to **Authentication → Policies** to add RLS policies
6. Go to **Storage** to create buckets manually

Note: Using the SQL migrations is much faster and less error-prone.

## Next Steps

Once Supabase is configured:

1. ✅ Verify setup with `npx ts-node scripts/verify-database.ts`
2. ✅ Test authentication by running the app and signing up
3. ✅ Test group join with access code `ABG2024`
4. ✅ Proceed with implementing remaining tasks

## Adding More Groups

To add additional groups for your organization:

```sql
INSERT INTO groups (name, access_code) 
VALUES ('Your Chapter Name', 'YOURCODE');
```

Access codes should be:
- Unique across all groups
- Easy to remember and share
- 6-10 characters recommended

## Security Best Practices

- ✅ Never commit `.env` file to version control
- ✅ Use the anon key in the app (not service_role key)
- ✅ Keep your database password secure
- ✅ RLS policies are enforced automatically
- ✅ Storage files are private by default
- ✅ Review policies before production deployment

## Support

For issues with:
- **Supabase setup**: Check [Supabase Documentation](https://supabase.com/docs)
- **SQL errors**: Review migration files for syntax
- **App connection**: Verify `.env` configuration
- **RLS policies**: Test with different user roles
