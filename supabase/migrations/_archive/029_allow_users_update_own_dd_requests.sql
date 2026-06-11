-- Allow users to update their own DD requests
-- This is needed for the upsert operation when re-requesting after rejection

CREATE POLICY "Users can update their own DD requests"
ON dd_requests
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
