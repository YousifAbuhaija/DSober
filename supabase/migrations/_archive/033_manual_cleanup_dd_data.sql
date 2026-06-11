-- Manual cleanup function for DD data
-- This can be called to clean up a specific user's DD data if they're in an intermediate state

CREATE OR REPLACE FUNCTION manual_cleanup_dd_data(p_user_email TEXT)
RETURNS TABLE(
  deleted_assignments INTEGER,
  deleted_requests INTEGER,
  ended_sessions INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_assignments_count INTEGER;
  v_requests_count INTEGER;
  v_sessions_count INTEGER;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id
  FROM users
  WHERE email = p_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', p_user_email;
  END IF;
  
  -- Delete DD assignments
  DELETE FROM dd_assignments
  WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_assignments_count = ROW_COUNT;
  
  -- Delete DD requests
  DELETE FROM dd_requests
  WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_requests_count = ROW_COUNT;
  
  -- End active sessions
  UPDATE dd_sessions
  SET ended_at = NOW(),
      is_active = false
  WHERE user_id = v_user_id
    AND is_active = true;
  GET DIAGNOSTICS v_sessions_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_assignments_count, v_requests_count, v_sessions_count;
END;
$$;

COMMENT ON FUNCTION manual_cleanup_dd_data(TEXT) IS 
  'Manually clean up DD assignments, requests, and sessions for a specific user by email';

-- Grant execute to authenticated users (admins can use this)
GRANT EXECUTE ON FUNCTION manual_cleanup_dd_data(TEXT) TO authenticated;
