# Supabase Setup Guide

This guide will help you set up your Supabase backend for the DSober application.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in the project details:
   - Name: DSober
   - Database Password: (choose a strong password)
   - Region: (choose closest to your location)
5. Wait for the project to be created

## 2. Get Your API Credentials

1. In your Supabase project dashboard, go to Settings → API
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")
3. Update your `.env` file with these values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Set Up Database Tables

You'll need to create the following tables in your Supabase database. Go to the SQL Editor in your Supabase dashboard and run the SQL scripts for each table.

### Tables to Create:
1. **users** - User profiles and information
2. **groups** - Fraternity/sorority organizations
3. **events** - Social events requiring DDs
4. **dd_requests** - Requests to be a DD for an event
5. **dd_assignments** - Approved DD assignments
6. **sep_baselines** - User baseline measurements
7. **sep_attempts** - SEP verification attempts
8. **dd_sessions** - Active DD sessions
9. **admin_alerts** - Alerts for admins

Refer to the design document (`.kiro/specs/dsober-dd-management/design.md`) for the complete schema and RLS policies.

## 4. Set Up Storage Buckets

Create the following storage buckets in Supabase (Storage → Create bucket):

1. **license-photos**
   - Public: No
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png

2. **sep-selfies**
   - Public: No
   - File size limit: 2MB
   - Allowed MIME types: image/jpeg, image/png

3. **sep-audio**
   - Public: No
   - File size limit: 1MB
   - Allowed MIME types: audio/mp4, audio/mpeg, audio/x-m4a

## 5. Configure Row Level Security (RLS)

Enable RLS on all tables and set up policies according to the design document. This ensures users can only access data they're authorized to see.

## 6. Seed Initial Data

Create at least one group with an access code for testing:

```sql
INSERT INTO groups (name, access_code) 
VALUES ('Test Fraternity', 'TEST123');
```

## 7. Test the Connection

Run the app and try to sign up with a new account. If successful, you should see the user created in the Supabase Auth dashboard.

## Troubleshooting

- **Connection errors**: Verify your URL and anon key are correct in `.env`
- **Permission errors**: Check that RLS policies are set up correctly
- **Storage errors**: Ensure storage buckets are created and policies allow uploads

## Next Steps

Once Supabase is configured, you can proceed with implementing the remaining tasks in the implementation plan.
