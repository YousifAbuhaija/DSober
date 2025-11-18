-- ============================================================================
-- APPLY THIS SQL TO YOUR CLOUD SUPABASE DATABASE
-- ============================================================================
-- Go to: https://supabase.com/dashboard/project/hdkvgrpshgswdgsqihpp/sql/new
-- Copy and paste this entire file, then click "Run"
-- ============================================================================

-- 0. Enable pg_net extension (required for notifications)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Create cleanup trigger for DD revocation
CREATE OR REPLACE FUNCTION cleanup_dd_data_on_revocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_dd = true AND NEW.is_dd = false THEN
    DELETE FROM dd_assignments WHERE user_id = NEW.id;
    DELETE FROM dd_requests WHERE user_id = NEW.id;
    UPDATE dd_sessions SET ended_at = NOW(), is_active = false WHERE user_id = NEW.id AND is_active = true;
    RAISE NOTICE 'Cleaned up DD data for user %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dd_revocation ON users;
CREATE TRIGGER on_dd_revocation AFTER UPDATE OF is_dd ON users FOR EACH ROW EXECUTE FUNCTION cleanup_dd_data_on_revocation();

-- 2. Add UPDATE policy for dd_requests (allows upsert)
DROP POLICY IF EXISTS "Users can update their own DD requests" ON dd_requests;
CREATE POLICY "Users can update their own DD requests"
ON dd_requests
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Manual cleanup function (for fixing existing data)
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
  SELECT id INTO v_user_id FROM users WHERE email = p_user_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', p_user_email;
  END IF;
  
  DELETE FROM dd_assignments WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_assignments_count = ROW_COUNT;
  
  DELETE FROM dd_requests WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_requests_count = ROW_COUNT;
  
  UPDATE dd_sessions SET ended_at = NOW(), is_active = false WHERE user_id = v_user_id AND is_active = true;
  GET DIAGNOSTICS v_sessions_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_assignments_count, v_requests_count, v_sessions_count;
END;
$$;

-- 4. Update edge function URL to use cloud instead of localhost
CREATE OR REPLACE FUNCTION get_edge_function_url(function_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'https://hdkvgrpshgswdgsqihpp.supabase.co/functions/v1/' || function_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Clean up 1@test.com account specifically
SELECT * FROM manual_cleanup_dd_data('1@test.com');

-- ============================================================================
-- DONE! 
-- - Cleanup trigger is active
-- - 1@test.com has been cleaned up
-- - Edge function URL points to cloud (not localhost)
-- ============================================================================
