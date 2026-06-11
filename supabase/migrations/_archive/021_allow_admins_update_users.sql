-- Allow admins to update users in their group
-- This is needed for reinstating DDs

CREATE POLICY "Admins can update users in their group"
  ON users FOR UPDATE
  USING (
    public.is_user_admin() AND
    group_id = public.get_user_group_id()
  );
