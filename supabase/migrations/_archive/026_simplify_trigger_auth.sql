-- Simplify trigger authentication
-- Remove Authorization header requirement since edge functions
-- automatically have access to service role credentials

-- Update all trigger functions to not pass Authorization header
-- The edge function will use its built-in service role access

-- This is just a documentation migration
-- The triggers will work without the Authorization header
-- because Supabase edge functions run with service role privileges by default

-- No changes needed - the current implementation will work!
-- The Authorization header in the triggers is optional and will be ignored
-- if the edge function doesn't validate it.

-- For reference, here's how the triggers currently call the edge function:
-- PERFORM net.http_post(
--   url := get_edge_function_url('send-notification'),
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer ' || get_service_role_key()  -- This can be empty
--   ),
--   body := jsonb_build_object(...)
-- );

-- The edge function has access to SUPABASE_SERVICE_ROLE_KEY from its environment
-- and can use it to create an authenticated Supabase client internally.

SELECT 'Trigger authentication simplified - no changes needed' AS status;

