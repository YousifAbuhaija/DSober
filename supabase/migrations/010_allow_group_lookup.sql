-- Allow users to look up groups by access code during onboarding
-- This is needed so users without a group_id can validate access codes

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can read their own group" ON groups;

-- Create new policies
-- 1. Users can read their own group (after they've joined)
CREATE POLICY "Users can read their own group"
  ON groups FOR SELECT
  USING (id = public.get_user_group_id());

-- 2. Authenticated users can read any group (needed for access code validation)
CREATE POLICY "Authenticated users can read groups for joining"
  ON groups FOR SELECT
  USING (auth.uid() IS NOT NULL);
