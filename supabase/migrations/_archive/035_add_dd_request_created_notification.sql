-- Add notification trigger for when DD requests are created
-- Admins should be notified when someone requests to be a DD

-- Create trigger function
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
BEGIN
  -- Get event and user details
  SELECT e.name, e.group_id, u.name
  INTO v_event_name, v_group_id, v_user_name
  FROM events e
  JOIN users u ON u.id = NEW.user_id
  WHERE e.id = NEW.event_id;
  
  -- Send notification to all admins in the group
  PERFORM net.http_post(
    url := get_edge_function_url('send-notification'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_dd_request_created ON dd_requests;

CREATE TRIGGER on_dd_request_created
  AFTER INSERT ON dd_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_dd_request_created();

COMMENT ON FUNCTION notify_admins_on_dd_request_created() IS 
  'Notifies group admins when a user requests to be a DD for an event';
