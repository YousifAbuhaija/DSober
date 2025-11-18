-- Fix User Insert Policy for Signup
-- This migration fixes the RLS policy that prevents new users from creating their profile during signup

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Users can insert their own record" ON users;

-- Recreate the insert policy with a simpler check that doesn't cause recursion
-- During signup, the user doesn't exist yet, so we just need to verify they're authenticated
-- and trying to insert a record with their own auth.uid()
CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND id = auth.uid()
  );

-- Also ensure the helper functions handle NULL cases gracefully
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT group_id FROM public.users WHERE id = auth.uid()),
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;
