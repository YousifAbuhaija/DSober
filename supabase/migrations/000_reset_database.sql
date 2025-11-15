-- RESET DATABASE - Use this to start completely fresh
-- WARNING: This will delete ALL data and tables!

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS admin_alerts CASCADE;
DROP TABLE IF EXISTS dd_sessions CASCADE;
DROP TABLE IF EXISTS sep_attempts CASCADE;
DROP TABLE IF EXISTS sep_baselines CASCADE;
DROP TABLE IF EXISTS dd_assignments CASCADE;
DROP TABLE IF EXISTS dd_requests CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS groups CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.get_user_group_id();
DROP FUNCTION IF EXISTS public.is_user_admin();
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.set_user_email() CASCADE;

-- Drop storage buckets (if they exist)
DELETE FROM storage.buckets WHERE id IN ('license-photos', 'sep-selfies', 'sep-audio');

-- Note: After running this, run the migrations in order:
-- 1. 001_initial_schema.sql
-- 2. 003_fix_rls_policies.sql (instead of the old policies)
-- 3. 002_storage_setup.sql
