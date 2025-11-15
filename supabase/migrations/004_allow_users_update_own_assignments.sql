-- Allow users to update their own DD assignments
-- This is needed for SEP failure flow where users need to revoke their own assignments

-- Add policy for users to update their own DD assignments
CREATE POLICY "Users can update their own DD assignments"
  ON dd_assignments FOR UPDATE
  USING (user_id = auth.uid());
