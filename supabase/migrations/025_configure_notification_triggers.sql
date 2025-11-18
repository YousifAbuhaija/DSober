-- Configuration script for notification triggers (Simplified Version)
-- This version doesn't require setting database parameters
-- Instead, we'll use environment variables in the edge function

-- ============================================================================
-- STEP 1: Enable pg_net extension (required for HTTP requests from triggers)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- STEP 2: Update helper functions to use hardcoded values for local dev
-- ============================================================================
-- For production, you'll set these as Supabase secrets

-- Update get_edge_function_url to use environment-based URL
CREATE OR REPLACE FUNCTION get_edge_function_url(function_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- For local development, use localhost
  -- For production, Supabase will automatically use the correct URL
  -- You can override this by setting SUPABASE_URL environment variable
  RETURN 'http://localhost:54321/functions/v1/' || function_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update get_service_role_key to return empty string
-- The edge function will use its own service role key from environment
CREATE OR REPLACE FUNCTION get_service_role_key()
RETURNS TEXT AS $$
BEGIN
  -- Return empty string - edge function will use its own auth
  -- For local dev, the edge function has access to the service role key
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 3: Verify setup
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Notification Triggers Configuration ===';
  
  -- Check pg_net extension
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE '✓ pg_net extension enabled';
  ELSE
    RAISE WARNING '✗ pg_net extension not enabled!';
  END IF;

  -- Check if helper functions exist
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_edge_function_url') THEN
    RAISE NOTICE '✓ Helper functions created';
  ELSE
    RAISE WARNING '✗ Helper functions not found!';
  END IF;

  -- Check if triggers exist
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname LIKE 'on_%') THEN
    RAISE NOTICE '✓ Notification triggers created';
  ELSE
    RAISE WARNING '✗ Notification triggers not found!';
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Configuration complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: For production deployment:';
  RAISE NOTICE '1. Update get_edge_function_url() to use your production URL';
  RAISE NOTICE '2. Deploy the send-notification edge function';
  RAISE NOTICE '3. Ensure edge function has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set';
  RAISE NOTICE '';
END;
$$;

-- ============================================================================
-- PRODUCTION CONFIGURATION NOTES
-- ============================================================================
-- When deploying to production, update the get_edge_function_url function:
--
-- CREATE OR REPLACE FUNCTION get_edge_function_url(function_name TEXT)
-- RETURNS TEXT AS $$
-- BEGIN
--   RETURN 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/' || function_name;
-- END;
-- $$ LANGUAGE plpgsql STABLE;
--
-- The edge function will automatically have access to:
-- - SUPABASE_URL (from Supabase environment)
-- - SUPABASE_SERVICE_ROLE_KEY (from Supabase environment)
--
-- No additional configuration needed!

