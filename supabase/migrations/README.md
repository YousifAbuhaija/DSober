# Database Migrations

## How to Apply Migrations

These migration files need to be run manually in your Supabase SQL Editor.

### Steps:

1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**
5. Open the migration file you want to run (e.g., `013_add_ride_requests.sql`)
6. Copy the entire contents
7. Paste into the SQL Editor
8. Click **"Run"** to execute

### Migration Order

Run migrations in numerical order:
- `001_initial_schema_v2.sql` - Base schema (should already be applied)
- `002_seed_data.sql` - Seed data (should already be applied)
- `003_rls_policies.sql` - RLS policies (should already be applied)
- ... (other migrations)
- `011_add_phone_number_to_users.sql` - Phone number field
- `013_add_ride_requests.sql` - **NEW: Ride requests table (REQUIRED for Rides feature)**

### Current Status

If you're seeing errors about `ride_requests` table not found, you need to run:
- **`013_add_ride_requests.sql`** - This creates the ride_requests table and RLS policies

### Quick Reference

See `MIGRATION_INSTRUCTIONS.md` in the project root for detailed SQL commands and explanations.
