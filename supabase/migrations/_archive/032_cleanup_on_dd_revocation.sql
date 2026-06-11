-- Clean up DD assignments and requests when a user's DD status is revoked
-- This ensures that when a DD is reinstated, they can request positions cleanly

-- Create a trigger function that runs when is_dd is set to false
CREATE OR REPLACE FUNCTION cleanup_dd_data_on_revocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if is_dd changed from true to false
  IF OLD.is_dd = true AND NEW.is_dd = false THEN
    
    -- Delete all DD assignments for this user
    -- (We delete instead of setting status='revoked' to allow clean re-requests)
    DELETE FROM dd_assignments
    WHERE user_id = NEW.id;
    
    -- Delete all DD requests for this user
    -- (This allows them to make fresh requests when reinstated)
    DELETE FROM dd_requests
    WHERE user_id = NEW.id;
    
    -- End any active DD sessions
    UPDATE dd_sessions
    SET ended_at = NOW(),
        is_active = false
    WHERE user_id = NEW.id
      AND is_active = true;
    
    RAISE NOTICE 'Cleaned up DD data for user %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_dd_revocation ON users;

CREATE TRIGGER on_dd_revocation
  AFTER UPDATE OF is_dd ON users
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_dd_data_on_revocation();

COMMENT ON FUNCTION cleanup_dd_data_on_revocation() IS 
  'Automatically cleans up DD assignments, requests, and sessions when a user is revoked as DD';
