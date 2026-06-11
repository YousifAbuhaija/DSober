-- Fix RLS Policies - Remove Circular Dependencies
-- This migration fixes the infinite recursion issue in RLS policies

-- ============================================================================
-- DROP EXISTING POLICIES
-- ============================================================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read their own group" ON groups;
DROP POLICY IF EXISTS "Users can read their own record" ON users;
DROP POLICY IF EXISTS "Users can read other users in their group" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
DROP POLICY IF EXISTS "Admins can update users in their group" ON users;
DROP POLICY IF EXISTS "Users can read events in their group" ON events;
DROP POLICY IF EXISTS "Admins can create events in their group" ON events;
DROP POLICY IF EXISTS "Admins can update events in their group" ON events;
DROP POLICY IF EXISTS "Users can create their own DD requests" ON dd_requests;
DROP POLICY IF EXISTS "Users can read their own DD requests" ON dd_requests;
DROP POLICY IF EXISTS "Admins can read DD requests for their group events" ON dd_requests;
DROP POLICY IF EXISTS "Admins can update DD requests for their group events" ON dd_requests;
DROP POLICY IF EXISTS "Users can read DD assignments for events in their group" ON dd_assignments;
DROP POLICY IF EXISTS "Admins can create DD assignments for their group events" ON dd_assignments;
DROP POLICY IF EXISTS "Admins can update DD assignments for their group events" ON dd_assignments;
DROP POLICY IF EXISTS "Users can read their own baseline" ON sep_baselines;
DROP POLICY IF EXISTS "Users can insert their own baseline" ON sep_baselines;
DROP POLICY IF EXISTS "Users can update their own baseline" ON sep_baselines;
DROP POLICY IF EXISTS "Admins can read baselines for users in their group" ON sep_baselines;
DROP POLICY IF EXISTS "Users can read their own attempts" ON sep_attempts;
DROP POLICY IF EXISTS "Users can insert their own attempts" ON sep_attempts;
DROP POLICY IF EXISTS "Admins can read attempts for users in their group" ON sep_attempts;
DROP POLICY IF EXISTS "Users can read active sessions for events in their group" ON dd_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON dd_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON dd_sessions;
DROP POLICY IF EXISTS "Admins can read all sessions for their group events" ON dd_sessions;
DROP POLICY IF EXISTS "Admins can read alerts for their group events" ON admin_alerts;
DROP POLICY IF EXISTS "System can create admin alerts" ON admin_alerts;
DROP POLICY IF EXISTS "Admins can update alerts for their group events" ON admin_alerts;

-- ============================================================================
-- CREATE HELPER FUNCTIONS TO AVOID RECURSION
-- ============================================================================

-- Function to get user's group_id without causing recursion
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT group_id FROM public.users WHERE id = auth.uid();
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================================
-- RECREATE POLICIES WITHOUT RECURSION
-- ============================================================================

-- Groups policies
CREATE POLICY "Users can read their own group"
  ON groups FOR SELECT
  USING (id = public.get_user_group_id());

-- Users policies - simplified to avoid recursion
CREATE POLICY "Users can read their own record"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can read users in same group"
  ON users FOR SELECT
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

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
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own DD requests"
  ON dd_requests FOR SELECT
  USING (user_id = auth.uid());

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
CREATE POLICY "Users can read their own baseline"
  ON sep_baselines FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own baseline"
  ON sep_baselines FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own baseline"
  ON sep_baselines FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read baselines for users in their group"
  ON sep_baselines FOR SELECT
  USING (
    public.is_user_admin() AND
    user_id IN (
      SELECT id FROM users WHERE group_id = public.get_user_group_id()
    )
  );

-- SEP Attempts policies
CREATE POLICY "Users can read their own attempts"
  ON sep_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own attempts"
  ON sep_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

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

CREATE POLICY "Users can insert their own sessions"
  ON dd_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON dd_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- Admin Alerts policies
CREATE POLICY "Admins can read alerts for their group events"
  ON admin_alerts FOR SELECT
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "System can create admin alerts"
  ON admin_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts for their group events"
  ON admin_alerts FOR UPDATE
  USING (
    public.is_user_admin() AND
    event_id IN (
      SELECT id FROM events WHERE group_id = public.get_user_group_id()
    )
  );
