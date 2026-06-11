-- Fix DD Requests INSERT policy to allow users to create requests for events in their group
-- The current policy only checks user_id but doesn't verify the event is in their group

DROP POLICY IF EXISTS "Users can create their own DD requests" ON dd_requests;

CREATE POLICY "Users can create their own DD requests"
  ON dd_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );
