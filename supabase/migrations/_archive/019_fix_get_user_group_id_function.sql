-- Fix get_user_group_id function to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures auth.uid() works correctly inside the function
-- CASCADE will drop and recreate all dependent policies

DROP FUNCTION IF EXISTS public.get_user_group_id() CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY INVOKER  -- Changed from SECURITY DEFINER to fix auth.uid() context
AS $$
  SELECT group_id FROM public.users WHERE id = auth.uid();
$$;

-- Recreate all the RLS policies that depend on this function
-- (They were dropped by CASCADE above)

-- Groups policies
CREATE POLICY "Users can read their own group"
  ON groups FOR SELECT
  USING (id = public.get_user_group_id());

-- Users policies
CREATE POLICY "Users can read users in same group"
  ON users FOR SELECT
  USING (group_id = public.get_user_group_id());

-- Events policies
CREATE POLICY "Users can read events in their group"
  ON events FOR SELECT
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can create events in their group"
  ON events FOR INSERT
  WITH CHECK (
    group_id = public.get_user_group_id() AND public.is_user_admin()
  );

CREATE POLICY "Admins can update events in their group"
  ON events FOR UPDATE
  USING (
    group_id = public.get_user_group_id() AND public.is_user_admin()
  );

-- DD Requests policies
CREATE POLICY "Users can create their own DD requests"
  ON dd_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can read DD requests for their group events"
  ON dd_requests FOR SELECT
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can update DD requests for their group events"
  ON dd_requests FOR UPDATE
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

-- DD Assignments policies
CREATE POLICY "Users can read DD assignments for events in their group"
  ON dd_assignments FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can create DD assignments for their group events"
  ON dd_assignments FOR INSERT
  WITH CHECK (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can update DD assignments for their group events"
  ON dd_assignments FOR UPDATE
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

-- SEP Baselines policies
CREATE POLICY "Admins can read baselines for users in their group"
  ON sep_baselines FOR SELECT
  USING (
    public.is_user_admin() AND
    user_id IN (
      SELECT id FROM users WHERE group_id = public.get_user_group_id()
    )
  );

-- SEP Attempts policies
CREATE POLICY "Admins can read attempts for users in their group"
  ON sep_attempts FOR SELECT
  USING (
    public.is_user_admin() AND
    user_id IN (
      SELECT id FROM users WHERE group_id = public.get_user_group_id()
    )
  );

-- DD Sessions policies
CREATE POLICY "Users can read active sessions for events in their group"
  ON dd_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

-- Admin Alerts policies
CREATE POLICY "Admins can read alerts for their group events"
  ON admin_alerts FOR SELECT
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can update alerts for their group events"
  ON admin_alerts FOR UPDATE
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );
