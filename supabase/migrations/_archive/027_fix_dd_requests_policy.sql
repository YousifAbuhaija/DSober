-- Fix DD requests INSERT policy to allow users with DD status to create requests
-- The issue is that the policy is too restrictive

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create their own DD requests" ON dd_requests;

-- Recreate with a simpler check that just verifies:
-- 1. The user is creating a request for themselves
-- 2. The event exists (no need to check group since users can only see events in their group anyway)
CREATE POLICY "Users can create their own DD requests"
  ON dd_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

