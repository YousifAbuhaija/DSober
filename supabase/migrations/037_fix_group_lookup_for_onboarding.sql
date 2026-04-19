-- Fix group lookup for onboarding users
-- Migration 020 dropped all policies including the one from 010 that allowed
-- authenticated users without a group_id to look up groups by access code.
-- Without this, get_user_group_id() returns NULL for new users, so the
-- "Users can read their own group" policy never matches and access codes fail.

CREATE POLICY "Authenticated users can read groups for joining"
  ON groups FOR SELECT
  USING (auth.uid() IS NOT NULL);
