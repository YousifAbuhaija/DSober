-- Fix DD request notification trigger with better error handling and logging

CREATE OR REPLACE FUNCTION notify_admins_on_dd_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_name TEXT;
  v_user_name TEXT;
  v_group_id UUID;
  v_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- Log that trigger fired
  RAISE NOTICE 'DD request trigger fired for request ID: %', NEW.id;
  
  -- Get event and user details
  SELECT e.name, e.group_id, u.name
  INTO v_event_name, v_group_id, v_user_name
  FROM events e
  JOIN users u ON u.id = NEW.user_id
  WHERE e.id = NEW.event_id;
  
  -- Log the details
  RAISE NOTICE 'Event: %, Group: %, User: %', v_event_name, v_group_id, v_user_name;
  
  -- Get edge function URL
  v_url := get_edge_function_url('send-notification');
  RAISE NOTICE 'Edge function URL: %', v_url;
  
  -- Send notification to all admins in the group
  SELECT net.http_post(
    url := v_url,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.jwt.claims', true)::json->>'token' || '"}'::jsonb,
    body := jsonb_build_object(
      'type', 'dd_request_created',
      'groupId', v_group_id,
      'data', jsonb_build_object(
        'userName', v_user_name,
        'eventName', v_event_name,
        'eventId', NEW.event_id,
        'requestId', NEW.id
      )
    )
  ) INTO v_response_id;
  
  RAISE NOTICE 'HTTP request sent, response ID: %', v_response_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the insert
    RAISE WARNING 'Error in notify_admins_on_dd_request_created: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_admins_on_dd_request_created() IS 
  'Notifies group admins when a user requests to be a DD for an event. Includes error handling and logging.';
