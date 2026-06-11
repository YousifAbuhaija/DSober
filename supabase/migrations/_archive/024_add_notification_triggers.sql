-- Migration: Add notification triggers for automatic push notifications
-- This migration creates database triggers that automatically send push notifications
-- when specific events occur (ride requests, status changes, SEP failures, etc.)

-- ============================================================================
-- Helper: Get Supabase Edge Function URL
-- ============================================================================
-- This function constructs the URL for calling the send-notification edge function
-- It uses the SUPABASE_URL environment variable set in the database

CREATE OR REPLACE FUNCTION get_edge_function_url(function_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Get the Supabase URL from settings
  -- Format: https://[project-ref].supabase.co/functions/v1/[function-name]
  RETURN current_setting('app.supabase_url', true) || '/functions/v1/' || function_name;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to a placeholder if setting is not configured
    RAISE WARNING 'app.supabase_url not configured, using placeholder';
    RETURN 'http://localhost:54321/functions/v1/' || function_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Helper: Get service role key for authenticated edge function calls
-- ============================================================================

CREATE OR REPLACE FUNCTION get_service_role_key()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.service_role_key', true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'app.service_role_key not configured';
    RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8.1: Trigger for ride request notifications
-- ============================================================================
-- Notifies the assigned DD when a new ride request is created
-- Requirements: 2.1, 2.2, 2.3, 2.4

CREATE OR REPLACE FUNCTION notify_dd_on_ride_request()
RETURNS TRIGGER AS $$
DECLARE
  v_rider_name TEXT;
  v_event_id UUID;
BEGIN
  -- Get rider's name for the notification
  SELECT name INTO v_rider_name
  FROM users
  WHERE id = NEW.rider_user_id;

  -- Call the send-notification edge function
  -- Using pg_net extension for async HTTP requests
  PERFORM net.http_post(
    url := get_edge_function_url('send-notification'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_service_role_key()
    ),
    body := jsonb_build_object(
      'type', 'ride_request',
      'userId', NEW.dd_user_id,
      'data', jsonb_build_object(
        'rideRequestId', NEW.id,
        'riderUserId', NEW.rider_user_id,
        'riderName', v_rider_name,
        'eventId', NEW.event_id,
        'pickupLocation', NEW.pickup_location_text
      )
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send ride request notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on ride_requests table
DROP TRIGGER IF EXISTS on_ride_request_created ON ride_requests;
CREATE TRIGGER on_ride_request_created
  AFTER INSERT ON ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_dd_on_ride_request();

COMMENT ON FUNCTION notify_dd_on_ride_request() IS 
  'Sends push notification to DD when a new ride request is created';


-- ============================================================================
-- 8.2: Trigger for ride status notifications
-- ============================================================================
-- Notifies the rider when their ride status changes (accepted, picked_up, cancelled)
-- Requirements: 3.1, 3.2, 3.3, 3.4

CREATE OR REPLACE FUNCTION notify_rider_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_dd_name TEXT;
  v_car_info TEXT;
  v_notification_type TEXT;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get DD's name and car info for the notification
    SELECT 
      name,
      CASE 
        WHEN car_make IS NOT NULL AND car_model IS NOT NULL THEN car_make || ' ' || car_model
        WHEN car_make IS NOT NULL THEN car_make
        ELSE NULL
      END
    INTO v_dd_name, v_car_info
    FROM users
    WHERE id = NEW.dd_user_id;

    -- Determine notification type based on new status
    CASE NEW.status
      WHEN 'accepted' THEN
        v_notification_type := 'ride_accepted';
      WHEN 'picked_up' THEN
        v_notification_type := 'ride_picked_up';
      WHEN 'cancelled' THEN
        v_notification_type := 'ride_cancelled';
      ELSE
        -- Don't send notifications for other status changes (pending, completed)
        RETURN NEW;
    END CASE;

    -- Call the send-notification edge function
    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := jsonb_build_object(
        'type', v_notification_type,
        'userId', NEW.rider_user_id,
        'data', jsonb_build_object(
          'rideRequestId', NEW.id,
          'status', NEW.status,
          'ddUserId', NEW.dd_user_id,
          'ddName', v_dd_name,
          'carInfo', v_car_info,
          'eventId', NEW.event_id
        )
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'Failed to send ride status notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on ride_requests table
DROP TRIGGER IF EXISTS on_ride_status_changed ON ride_requests;
CREATE TRIGGER on_ride_status_changed
  AFTER UPDATE ON ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_rider_on_status_change();

COMMENT ON FUNCTION notify_rider_on_status_change() IS 
  'Sends push notification to rider when ride status changes (accepted, picked_up, cancelled)';


-- ============================================================================
-- 8.3: Trigger for SEP failure notifications
-- ============================================================================
-- Notifies all admins in the group when a user fails SEP verification
-- Requirements: 4.1, 4.2, 4.3, 4.4

CREATE OR REPLACE FUNCTION notify_admins_on_sep_failure()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_event_name TEXT;
  v_group_id UUID;
BEGIN
  -- Only notify on failures
  IF NEW.result = 'fail' THEN
    -- Get user's name, event name, and group ID
    SELECT 
      u.name,
      u.group_id,
      e.name
    INTO v_user_name, v_group_id, v_event_name
    FROM users u
    LEFT JOIN events e ON e.id = NEW.event_id
    WHERE u.id = NEW.user_id;

    -- Only send notification if user belongs to a group
    IF v_group_id IS NOT NULL THEN
      -- Call the send-notification edge function with groupId to notify all admins
      PERFORM net.http_post(
        url := get_edge_function_url('send-notification'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || get_service_role_key()
        ),
        body := jsonb_build_object(
          'type', 'sep_failure',
          'groupId', v_group_id,
          'data', jsonb_build_object(
            'sepAttemptId', NEW.id,
            'userId', NEW.user_id,
            'userName', v_user_name,
            'eventId', NEW.event_id,
            'eventName', v_event_name
          )
        )
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send SEP failure notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on sep_attempts table
DROP TRIGGER IF EXISTS on_sep_failure ON sep_attempts;
CREATE TRIGGER on_sep_failure
  AFTER INSERT ON sep_attempts
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_sep_failure();

COMMENT ON FUNCTION notify_admins_on_sep_failure() IS 
  'Sends critical push notification to all group admins when a user fails SEP verification';


-- ============================================================================
-- 8.4: Trigger for DD request status notifications
-- ============================================================================
-- Notifies the user when their DD request is approved or rejected
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

CREATE OR REPLACE FUNCTION notify_user_on_dd_request_update()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type TEXT;
  v_rejection_reason TEXT;
BEGIN
  -- Only notify on status changes from pending to approved/rejected
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    -- Determine notification type based on new status
    CASE NEW.status
      WHEN 'approved' THEN
        v_notification_type := 'dd_request_approved';
      WHEN 'rejected' THEN
        v_notification_type := 'dd_request_rejected';
        -- You could add a rejection_reason column to dd_requests table
        -- For now, we'll use a generic message
        v_rejection_reason := 'Requirements not met';
      ELSE
        RETURN NEW;
    END CASE;

    -- Call the send-notification edge function
    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := jsonb_build_object(
        'type', v_notification_type,
        'userId', NEW.user_id,
        'data', jsonb_build_object(
          'ddRequestId', NEW.id,
          'eventId', NEW.event_id,
          'status', NEW.status,
          'reason', v_rejection_reason
        )
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'Failed to send DD request notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on dd_requests table
DROP TRIGGER IF EXISTS on_dd_request_status_changed ON dd_requests;
CREATE TRIGGER on_dd_request_status_changed
  AFTER UPDATE ON dd_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_dd_request_update();

COMMENT ON FUNCTION notify_user_on_dd_request_update() IS 
  'Sends push notification to user when their DD request is approved or rejected';


-- ============================================================================
-- 8.5: Triggers for DD session notifications
-- ============================================================================
-- Notifies DD when session starts and when DD status is revoked
-- Requirements: 5.1, 5.2, 5.3, 5.5

-- Trigger function for DD session start confirmation
CREATE OR REPLACE FUNCTION notify_dd_on_session_start()
RETURNS TRIGGER AS $$
DECLARE
  v_event_name TEXT;
BEGIN
  -- Get event name for the notification
  SELECT name INTO v_event_name
  FROM events
  WHERE id = NEW.event_id;

  -- Call the send-notification edge function
  PERFORM net.http_post(
    url := get_edge_function_url('send-notification'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_service_role_key()
    ),
    body := jsonb_build_object(
      'type', 'dd_session_started',
      'userId', NEW.user_id,
      'data', jsonb_build_object(
        'sessionId', NEW.id,
        'eventId', NEW.event_id,
        'eventName', v_event_name,
        'startedAt', NEW.started_at
      )
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send DD session start notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on dd_sessions table
DROP TRIGGER IF EXISTS on_dd_session_started ON dd_sessions;
CREATE TRIGGER on_dd_session_started
  AFTER INSERT ON dd_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_dd_on_session_start();

COMMENT ON FUNCTION notify_dd_on_session_start() IS 
  'Sends push notification to DD when they successfully start a DD session';

-- Trigger function for DD status revocation
CREATE OR REPLACE FUNCTION notify_dd_on_revocation()
RETURNS TRIGGER AS $$
DECLARE
  v_revocation_reason TEXT;
BEGIN
  -- Only notify when dd_status changes to 'revoked'
  IF OLD.dd_status != 'revoked' AND NEW.dd_status = 'revoked' THEN
    -- Default revocation reason (could be enhanced with a separate column)
    v_revocation_reason := 'Policy violation or safety concern';

    -- Call the send-notification edge function
    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := jsonb_build_object(
        'type', 'dd_revoked',
        'userId', NEW.id,
        'data', jsonb_build_object(
          'userId', NEW.id,
          'reason', v_revocation_reason,
          'revokedAt', NOW()
        )
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'Failed to send DD revocation notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on users table for dd_status changes
DROP TRIGGER IF EXISTS on_dd_status_revoked ON users;
CREATE TRIGGER on_dd_status_revoked
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.dd_status = 'revoked')
  EXECUTE FUNCTION notify_dd_on_revocation();

COMMENT ON FUNCTION notify_dd_on_revocation() IS 
  'Sends critical push notification to DD when their DD status is revoked';


-- ============================================================================
-- 8.6: Trigger for event notifications
-- ============================================================================
-- Notifies group members when event status changes to 'active' or is cancelled
-- Requirements: 6.1, 6.2

CREATE OR REPLACE FUNCTION notify_members_on_event_status()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type TEXT;
  v_user_id UUID;
BEGIN
  -- Only notify on status changes to 'active' or when event is cancelled
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'active' THEN
        v_notification_type := 'event_active';
      WHEN 'cancelled' THEN
        v_notification_type := 'event_cancelled';
      ELSE
        -- Don't send notifications for other status changes
        RETURN NEW;
    END CASE;

    -- Notify all users in the group who have interacted with the event
    -- This includes: event creator, DDs assigned to event, users with ride requests
    FOR v_user_id IN (
      SELECT DISTINCT user_id FROM (
        -- Event creator
        SELECT NEW.created_by_user_id AS user_id
        UNION
        -- DDs assigned to this event
        SELECT user_id FROM dd_assignments WHERE event_id = NEW.id
        UNION
        -- Users with ride requests for this event
        SELECT rider_user_id AS user_id FROM ride_requests WHERE event_id = NEW.id
        UNION
        -- DDs with ride requests for this event
        SELECT dd_user_id AS user_id FROM ride_requests WHERE event_id = NEW.id
      ) AS event_participants
    )
    LOOP
      -- Call the send-notification edge function for each user
      PERFORM net.http_post(
        url := get_edge_function_url('send-notification'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || get_service_role_key()
        ),
        body := jsonb_build_object(
          'type', v_notification_type,
          'userId', v_user_id,
          'data', jsonb_build_object(
            'eventId', NEW.id,
            'eventName', NEW.name,
            'status', NEW.status,
            'reason', CASE WHEN NEW.status = 'cancelled' THEN 'Event has been cancelled' ELSE NULL END
          )
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'Failed to send event status notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on events table
DROP TRIGGER IF EXISTS on_event_status_changed ON events;
CREATE TRIGGER on_event_status_changed
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_members_on_event_status();

COMMENT ON FUNCTION notify_members_on_event_status() IS 
  'Sends push notification to event participants when event becomes active or is cancelled';


-- ============================================================================
-- 8.7: Trigger for DD assignment notifications
-- ============================================================================
-- Notifies user when they are assigned as DD for an event
-- Requirements: 6.3

CREATE OR REPLACE FUNCTION notify_user_on_dd_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_event_name TEXT;
BEGIN
  -- Only notify on new assignments (not revocations)
  IF NEW.status = 'assigned' THEN
    -- Get event name for the notification
    SELECT name INTO v_event_name
    FROM events
    WHERE id = NEW.event_id;

    -- Call the send-notification edge function
    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := jsonb_build_object(
        'type', 'dd_assigned',
        'userId', NEW.user_id,
        'data', jsonb_build_object(
          'assignmentId', NEW.id,
          'eventId', NEW.event_id,
          'eventName', v_event_name
        )
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send DD assignment notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on dd_assignments table
DROP TRIGGER IF EXISTS on_dd_assigned ON dd_assignments;
CREATE TRIGGER on_dd_assigned
  AFTER INSERT ON dd_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_on_dd_assignment();

COMMENT ON FUNCTION notify_user_on_dd_assignment() IS 
  'Sends push notification to user when they are assigned as DD for an event';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- All notification triggers have been created successfully
-- The triggers will automatically send push notifications via the send-notification
-- edge function when the following events occur:
--   1. New ride request created
--   2. Ride status changes (accepted, picked_up, cancelled)
--   3. SEP verification failure
--   4. DD request approved/rejected
--   5. DD session started
--   6. DD status revoked
--   7. Event status changes (active, cancelled)
--   8. DD assigned to event

