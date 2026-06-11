


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."notify_secret"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select decrypted_secret from vault.decrypted_secrets where name = 'notify_webhook_secret' limit 1 $$;


ALTER FUNCTION "private"."notify_secret"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_dd_data_on_revocation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."cleanup_dd_data_on_revocation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_dd_data_on_revocation"() IS 'Automatically cleans up DD assignments, requests, and sessions when a user is revoked as DD';



CREATE OR REPLACE FUNCTION "public"."create_notification_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_edge_function_url"("function_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Use Supabase Cloud URL for production
  -- Format: https://<project-ref>.supabase.co/functions/v1/<function-name>
  RETURN 'https://ybsinrajanwhabgivsvv.supabase.co/functions/v1/' || function_name;
END;
$$;


ALTER FUNCTION "public"."get_edge_function_url"("function_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_edge_function_url"("function_name" "text") IS 'Returns the URL for Supabase Edge Functions (Cloud deployment)';



CREATE OR REPLACE FUNCTION "public"."get_service_role_key"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Return empty string - edge function will use its own auth
  -- For local dev, the edge function has access to the service role key
  RETURN '';
END;
$$;


ALTER FUNCTION "public"."get_service_role_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_group_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT group_id FROM public.users WHERE id = auth.uid()),
    NULL
  );
$$;


ALTER FUNCTION "public"."get_user_group_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select role from public.users where id = auth.uid() $$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_email_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email,
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_email_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;


ALTER FUNCTION "public"."is_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_group_with_code"("p_code" "text") RETURNS TABLE("group_id" "uuid", "group_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group public.groups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_group from public.groups g
   where upper(g.access_code) = upper(trim(p_code));
  if not found then
    raise exception 'Invalid access code';
  end if;
  update public.users set group_id = v_group.id where id = auth.uid();
  if not found then
    raise exception 'Complete your profile before joining a group';
  end if;
  return query select v_group.id, v_group.name;
end $$;


ALTER FUNCTION "public"."join_group_with_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins_on_dd_request_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event_name TEXT;
  v_user_name TEXT;
  v_group_id UUID;
  v_url TEXT;
  v_response_id BIGINT;
BEGIN
  RAISE NOTICE 'DD request trigger fired for request ID: %', NEW.id;

  SELECT e.name, e.group_id, u.name
  INTO v_event_name, v_group_id, v_user_name
  FROM events e
  JOIN users u ON u.id = NEW.user_id
  WHERE e.id = NEW.event_id;

  v_url := get_edge_function_url('send-notification');

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', private.notify_secret()
    ),
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

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_admins_on_dd_request_created: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_admins_on_dd_request_created"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_admins_on_dd_request_created"() IS 'Notifies group admins when a user requests to be a DD for an event. Includes error handling and logging.';



CREATE OR REPLACE FUNCTION "public"."notify_admins_on_sep_failure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_name TEXT;
  v_event_name TEXT;
  v_group_id UUID;
BEGIN
  IF NEW.result = 'fail' THEN
    SELECT
      u.name,
      u.group_id,
      e.name
    INTO v_user_name, v_group_id, v_event_name
    FROM users u
    LEFT JOIN events e ON e.id = NEW.event_id
    WHERE u.id = NEW.user_id;

    IF v_group_id IS NOT NULL THEN
      PERFORM net.http_post(
        url := get_edge_function_url('send-notification'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send SEP failure notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_admins_on_sep_failure"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_admins_on_sep_failure"() IS 'Sends critical push notification to all group admins when a user fails SEP verification';



CREATE OR REPLACE FUNCTION "public"."notify_dd_on_revocation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_revocation_reason TEXT;
BEGIN
  IF OLD.dd_status != 'revoked' AND NEW.dd_status = 'revoked' THEN
    v_revocation_reason := 'Policy violation or safety concern';

    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send DD revocation notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_dd_on_revocation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_dd_on_revocation"() IS 'Sends critical push notification to DD when their DD status is revoked';



CREATE OR REPLACE FUNCTION "public"."notify_dd_on_ride_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rider_name TEXT;
  v_event_id UUID;
BEGIN
  SELECT name INTO v_rider_name
  FROM users
  WHERE id = NEW.rider_user_id;

  PERFORM net.http_post(
    url := get_edge_function_url('send-notification'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send ride request notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_dd_on_ride_request"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_dd_on_ride_request"() IS 'Sends push notification to DD when a new ride request is created';



CREATE OR REPLACE FUNCTION "public"."notify_dd_on_session_start"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event_name TEXT;
BEGIN
  SELECT name INTO v_event_name
  FROM events
  WHERE id = NEW.event_id;

  PERFORM net.http_post(
    url := get_edge_function_url('send-notification'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send DD session start notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_dd_on_session_start"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_dd_on_session_start"() IS 'Sends push notification to DD when they successfully start a DD session';



CREATE OR REPLACE FUNCTION "public"."notify_members_on_event_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_notification_type TEXT;
  v_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'active' THEN
        v_notification_type := 'event_active';
      WHEN 'cancelled' THEN
        v_notification_type := 'event_cancelled';
      ELSE
        RETURN NEW;
    END CASE;

    FOR v_user_id IN (
      SELECT DISTINCT user_id FROM (
        SELECT NEW.created_by_user_id AS user_id
        UNION
        SELECT user_id FROM dd_assignments WHERE event_id = NEW.id
        UNION
        SELECT rider_user_id AS user_id FROM ride_requests WHERE event_id = NEW.id
        UNION
        SELECT dd_user_id AS user_id FROM ride_requests WHERE event_id = NEW.id
      ) AS event_participants
    )
    LOOP
      PERFORM net.http_post(
        url := get_edge_function_url('send-notification'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send event status notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_members_on_event_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_members_on_event_status"() IS 'Sends push notification to event participants when event becomes active or is cancelled';



CREATE OR REPLACE FUNCTION "public"."notify_rider_on_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_dd_name TEXT;
  v_car_info TEXT;
  v_notification_type TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
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

    CASE NEW.status
      WHEN 'accepted' THEN
        v_notification_type := 'ride_accepted';
      WHEN 'picked_up' THEN
        v_notification_type := 'ride_picked_up';
      WHEN 'cancelled' THEN
        v_notification_type := 'ride_cancelled';
      ELSE
        RETURN NEW;
    END CASE;

    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send ride status notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_rider_on_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_rider_on_status_change"() IS 'Sends push notification to rider when ride status changes (accepted, picked_up, cancelled)';



CREATE OR REPLACE FUNCTION "public"."notify_user_on_dd_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event_name TEXT;
BEGIN
  IF NEW.status = 'assigned' THEN
    SELECT name INTO v_event_name
    FROM events
    WHERE id = NEW.event_id;

    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send DD assignment notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_user_on_dd_assignment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_user_on_dd_assignment"() IS 'Sends push notification to user when they are assigned as DD for an event';



CREATE OR REPLACE FUNCTION "public"."notify_user_on_dd_request_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_notification_type TEXT;
  v_rejection_reason TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    CASE NEW.status
      WHEN 'approved' THEN
        v_notification_type := 'dd_request_approved';
      WHEN 'rejected' THEN
        v_notification_type := 'dd_request_rejected';
        v_rejection_reason := 'Requirements not met';
      ELSE
        RETURN NEW;
    END CASE;

    PERFORM net.http_post(
      url := get_edge_function_url('send-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', private.notify_secret()
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
    RAISE WARNING 'Failed to send DD request notification: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_user_on_dd_request_update"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_user_on_dd_request_update"() IS 'Sends push notification to user when their DD request is approved or rejected';



CREATE OR REPLACE FUNCTION "public"."set_user_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.email = (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sep_attempt_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by_admin_id" "uuid",
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."admin_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dd_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dd_assignments_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."dd_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dd_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dd_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."dd_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dd_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."dd_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "date_time" timestamp with time zone NOT NULL,
    "location_text" "text" NOT NULL,
    "status" "text" DEFAULT 'upcoming'::"text" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'active'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "access_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "ride_requests" boolean DEFAULT true,
    "ride_status_updates" boolean DEFAULT true,
    "event_updates" boolean DEFAULT true,
    "dd_request_updates" boolean DEFAULT true,
    "dd_session_reminders" boolean DEFAULT true,
    "sep_failure_alerts" boolean DEFAULT true,
    "dd_revocation_alerts" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "priority" "text" DEFAULT 'normal'::"text",
    "read" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failure_reason" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dd_user_id" "uuid" NOT NULL,
    "rider_user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "pickup_location_text" "text" NOT NULL,
    "pickup_latitude" numeric,
    "pickup_longitude" numeric,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "ride_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'picked_up'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ride_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sep_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "reaction_avg_ms" numeric NOT NULL,
    "phrase_duration_sec" numeric NOT NULL,
    "selfie_url" "text" NOT NULL,
    "result" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sep_attempts_result_check" CHECK (("result" = ANY (ARRAY['pass'::"text", 'fail'::"text"])))
);


ALTER TABLE "public"."sep_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sep_baselines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_avg_ms" numeric NOT NULL,
    "phrase_duration_sec" numeric NOT NULL,
    "selfie_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sep_baselines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expo_push_token" "text" NOT NULL,
    "device_name" "text",
    "device_os" "text",
    "app_version" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_devices_device_os_check" CHECK (("device_os" = ANY (ARRAY['ios'::"text", 'android'::"text"])))
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text" NOT NULL,
    "birthday" "date" NOT NULL,
    "age" integer,
    "gender" "text" NOT NULL,
    "group_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "is_dd" boolean DEFAULT false NOT NULL,
    "car_make" "text",
    "car_model" "text",
    "car_plate" "text",
    "license_photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dd_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "phone_number" "text",
    "profile_photo_url" "text",
    CONSTRAINT "users_dd_status_check" CHECK (("dd_status" = ANY (ARRAY['none'::"text", 'active'::"text", 'revoked'::"text"]))),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."profile_photo_url" IS 'URL to user profile photo stored in profile-photos bucket, visible on DD cards';



ALTER TABLE ONLY "public"."admin_alerts"
    ADD CONSTRAINT "admin_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dd_assignments"
    ADD CONSTRAINT "dd_assignments_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."dd_assignments"
    ADD CONSTRAINT "dd_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dd_requests"
    ADD CONSTRAINT "dd_requests_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."dd_requests"
    ADD CONSTRAINT "dd_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dd_sessions"
    ADD CONSTRAINT "dd_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_access_code_key" UNIQUE ("access_code");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_requests"
    ADD CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sep_attempts"
    ADD CONSTRAINT "sep_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sep_baselines"
    ADD CONSTRAINT "sep_baselines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sep_baselines"
    ADD CONSTRAINT "sep_baselines_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_expo_push_token_key" UNIQUE ("expo_push_token");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_alerts_event_id" ON "public"."admin_alerts" USING "btree" ("event_id");



CREATE INDEX "idx_admin_alerts_resolved_at" ON "public"."admin_alerts" USING "btree" ("resolved_at");



CREATE INDEX "idx_admin_alerts_resolved_by_admin_id" ON "public"."admin_alerts" USING "btree" ("resolved_by_admin_id");



CREATE INDEX "idx_admin_alerts_sep_attempt_id" ON "public"."admin_alerts" USING "btree" ("sep_attempt_id");



CREATE INDEX "idx_admin_alerts_user_id" ON "public"."admin_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_dd_assignments_event_id" ON "public"."dd_assignments" USING "btree" ("event_id");



CREATE INDEX "idx_dd_assignments_user_id" ON "public"."dd_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_dd_requests_event_id" ON "public"."dd_requests" USING "btree" ("event_id");



CREATE INDEX "idx_dd_requests_status" ON "public"."dd_requests" USING "btree" ("status");



CREATE INDEX "idx_dd_requests_user_id" ON "public"."dd_requests" USING "btree" ("user_id");



CREATE INDEX "idx_dd_sessions_event_id" ON "public"."dd_sessions" USING "btree" ("event_id");



CREATE INDEX "idx_dd_sessions_is_active" ON "public"."dd_sessions" USING "btree" ("is_active");



CREATE INDEX "idx_dd_sessions_user_id" ON "public"."dd_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_events_created_by_user_id" ON "public"."events" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_events_date_time" ON "public"."events" USING "btree" ("date_time");



CREATE INDEX "idx_events_group_id" ON "public"."events" USING "btree" ("group_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_ride_requests_created_at" ON "public"."ride_requests" USING "btree" ("created_at");



CREATE INDEX "idx_ride_requests_dd_user_id" ON "public"."ride_requests" USING "btree" ("dd_user_id");



CREATE INDEX "idx_ride_requests_event_id" ON "public"."ride_requests" USING "btree" ("event_id");



CREATE INDEX "idx_ride_requests_rider_user_id" ON "public"."ride_requests" USING "btree" ("rider_user_id");



CREATE INDEX "idx_ride_requests_status" ON "public"."ride_requests" USING "btree" ("status");



CREATE INDEX "idx_sep_attempts_event_id" ON "public"."sep_attempts" USING "btree" ("event_id");



CREATE INDEX "idx_sep_attempts_user_id" ON "public"."sep_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_user_devices_active" ON "public"."user_devices" USING "btree" ("is_active");



CREATE INDEX "idx_user_devices_token" ON "public"."user_devices" USING "btree" ("expo_push_token");



CREATE INDEX "idx_user_devices_user_id" ON "public"."user_devices" USING "btree" ("user_id");



CREATE INDEX "idx_users_dd_status" ON "public"."users" USING "btree" ("dd_status");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_group_id" ON "public"."users" USING "btree" ("group_id");



CREATE INDEX "idx_users_group_id_role" ON "public"."users" USING "btree" ("group_id", "role");



CREATE INDEX "idx_users_phone_number" ON "public"."users" USING "btree" ("phone_number");



CREATE UNIQUE INDEX "unique_active_ride_request" ON "public"."ride_requests" USING "btree" ("rider_user_id", "event_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'picked_up'::"text"]));



CREATE OR REPLACE TRIGGER "on_dd_assigned" AFTER INSERT ON "public"."dd_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_user_on_dd_assignment"();



CREATE OR REPLACE TRIGGER "on_dd_request_created" AFTER INSERT ON "public"."dd_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admins_on_dd_request_created"();



CREATE OR REPLACE TRIGGER "on_dd_request_status_changed" AFTER UPDATE ON "public"."dd_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_user_on_dd_request_update"();



CREATE OR REPLACE TRIGGER "on_dd_revocation" AFTER UPDATE OF "is_dd" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_dd_data_on_revocation"();



CREATE OR REPLACE TRIGGER "on_dd_session_started" AFTER INSERT ON "public"."dd_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_dd_on_session_start"();



CREATE OR REPLACE TRIGGER "on_dd_status_revoked" AFTER UPDATE ON "public"."users" FOR EACH ROW WHEN (("new"."dd_status" = 'revoked'::"text")) EXECUTE FUNCTION "public"."notify_dd_on_revocation"();



CREATE OR REPLACE TRIGGER "on_event_status_changed" AFTER UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_members_on_event_status"();



CREATE OR REPLACE TRIGGER "on_ride_request_created" AFTER INSERT ON "public"."ride_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_dd_on_ride_request"();



CREATE OR REPLACE TRIGGER "on_ride_status_changed" AFTER UPDATE ON "public"."ride_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_rider_on_status_change"();



CREATE OR REPLACE TRIGGER "on_sep_failure" AFTER INSERT ON "public"."sep_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admins_on_sep_failure"();



CREATE OR REPLACE TRIGGER "on_user_created_create_notification_preferences" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_preferences"();



CREATE OR REPLACE TRIGGER "set_user_email_on_insert" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_email"();



CREATE OR REPLACE TRIGGER "update_dd_assignments_updated_at" BEFORE UPDATE ON "public"."dd_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_devices_updated_at" BEFORE UPDATE ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_alerts"
    ADD CONSTRAINT "admin_alerts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_alerts"
    ADD CONSTRAINT "admin_alerts_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_alerts"
    ADD CONSTRAINT "admin_alerts_sep_attempt_id_fkey" FOREIGN KEY ("sep_attempt_id") REFERENCES "public"."sep_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_alerts"
    ADD CONSTRAINT "admin_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_assignments"
    ADD CONSTRAINT "dd_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_assignments"
    ADD CONSTRAINT "dd_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_requests"
    ADD CONSTRAINT "dd_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_requests"
    ADD CONSTRAINT "dd_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_sessions"
    ADD CONSTRAINT "dd_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dd_sessions"
    ADD CONSTRAINT "dd_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_requests"
    ADD CONSTRAINT "ride_requests_dd_user_id_fkey" FOREIGN KEY ("dd_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_requests"
    ADD CONSTRAINT "ride_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_requests"
    ADD CONSTRAINT "ride_requests_rider_user_id_fkey" FOREIGN KEY ("rider_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sep_attempts"
    ADD CONSTRAINT "sep_attempts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sep_attempts"
    ADD CONSTRAINT "sep_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sep_baselines"
    ADD CONSTRAINT "sep_baselines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;



CREATE POLICY "Admins can create DD assignments for their group events" ON "public"."dd_assignments" FOR INSERT WITH CHECK (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Admins can create events in their group" ON "public"."events" FOR INSERT WITH CHECK ((("group_id" = "public"."get_user_group_id"()) AND "public"."is_user_admin"()));



CREATE POLICY "Admins can delete DD assignments for their group events" ON "public"."dd_assignments" FOR DELETE USING (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Admins can read alerts for their group events" ON "public"."admin_alerts" FOR SELECT USING (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Admins can update DD assignments for their group events" ON "public"."dd_assignments" FOR UPDATE TO "authenticated" USING (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))))) WITH CHECK (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Admins can update DD requests for their group events" ON "public"."dd_requests" FOR UPDATE TO "authenticated" USING (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))))) WITH CHECK (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Admins can update alerts for their group events" ON "public"."admin_alerts" FOR UPDATE TO "authenticated" USING (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))))) WITH CHECK (("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Admins can update events in their group" ON "public"."events" FOR UPDATE TO "authenticated" USING ((("group_id" = "public"."get_user_group_id"()) AND "public"."is_user_admin"())) WITH CHECK ((("group_id" = "public"."get_user_group_id"()) AND "public"."is_user_admin"()));



CREATE POLICY "Admins can update users in their group" ON "public"."users" FOR UPDATE TO "authenticated" USING (("public"."is_user_admin"() AND ("group_id" = "public"."get_user_group_id"()))) WITH CHECK (("public"."is_user_admin"() AND ("group_id" = "public"."get_user_group_id"())));



CREATE POLICY "DDs can update their ride requests" ON "public"."ride_requests" FOR UPDATE TO "authenticated" USING (("dd_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("dd_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Members read own, admins read group DD requests" ON "public"."dd_requests" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))))));



CREATE POLICY "Members read own, admins read group SEP attempts" ON "public"."sep_attempts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."is_user_admin"() AND ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."group_id" = "public"."get_user_group_id"()))))));



CREATE POLICY "Members read own, admins read group SEP baselines" ON "public"."sep_baselines" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."is_user_admin"() AND ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."group_id" = "public"."get_user_group_id"()))))));



CREATE POLICY "Read ride requests: rider, DD, or group admin" ON "public"."ride_requests" FOR SELECT TO "authenticated" USING ((("rider_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("dd_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."is_user_admin"() AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))))));



CREATE POLICY "Riders can cancel their own ride requests" ON "public"."ride_requests" FOR UPDATE TO "authenticated" USING (("rider_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("rider_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['pending'::"text", 'cancelled'::"text"]))));



CREATE POLICY "Riders can create ride requests" ON "public"."ride_requests" FOR INSERT TO "authenticated" WITH CHECK ((("rider_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))) AND ("dd_user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Users can create their own DD requests" ON "public"."dd_requests" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"text") AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Users can delete their own devices" ON "public"."user_devices" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own attempts" ON "public"."sep_attempts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own baseline" ON "public"."sep_baselines" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own devices" ON "public"."user_devices" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own notification preferences" ON "public"."notification_preferences" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own record" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can insert their own sessions" ON "public"."dd_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"())))));



CREATE POLICY "Users can read DD assignments for events in their group" ON "public"."dd_assignments" FOR SELECT USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))));



CREATE POLICY "Users can read active sessions for events in their group" ON "public"."dd_sessions" FOR SELECT USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."group_id" = "public"."get_user_group_id"()))));



CREATE POLICY "Users can read events in their group" ON "public"."events" FOR SELECT USING (("group_id" = "public"."get_user_group_id"()));



CREATE POLICY "Users can read self or same-group users" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ("group_id" = "public"."get_user_group_id"())));



CREATE POLICY "Users can read their own group" ON "public"."groups" FOR SELECT USING (("id" = "public"."get_user_group_id"()));



CREATE POLICY "Users can update their own DD requests" ON "public"."dd_requests" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can update their own baseline" ON "public"."sep_baselines" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own devices" ON "public"."user_devices" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own notification preferences" ON "public"."notification_preferences" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own record" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("role" = "public"."get_user_role"()) AND (NOT ("group_id" IS DISTINCT FROM "public"."get_user_group_id"()))));



CREATE POLICY "Users can update their own sessions" ON "public"."dd_sessions" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own devices" ON "public"."user_devices" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own notification preferences" ON "public"."notification_preferences" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."admin_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dd_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dd_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dd_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sep_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sep_baselines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































REVOKE ALL ON FUNCTION "private"."notify_secret"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."cleanup_dd_data_on_revocation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_dd_data_on_revocation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notification_preferences"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notification_preferences"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_edge_function_url"("function_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_edge_function_url"("function_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_service_role_key"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_service_role_key"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_group_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_group_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_group_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_user_email_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_user_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_group_with_code"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_group_with_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_group_with_code"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_admins_on_dd_request_created"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_admins_on_dd_request_created"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_admins_on_sep_failure"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_admins_on_sep_failure"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_dd_on_revocation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_dd_on_revocation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_dd_on_ride_request"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_dd_on_ride_request"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_dd_on_session_start"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_dd_on_session_start"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_members_on_event_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_members_on_event_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_rider_on_status_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_rider_on_status_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_user_on_dd_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_user_on_dd_assignment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_user_on_dd_request_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_user_on_dd_request_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_email"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_updated_at_column"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_alerts" TO "anon";
GRANT ALL ON TABLE "public"."admin_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."dd_assignments" TO "anon";
GRANT ALL ON TABLE "public"."dd_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."dd_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."dd_requests" TO "anon";
GRANT ALL ON TABLE "public"."dd_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."dd_requests" TO "service_role";



GRANT ALL ON TABLE "public"."dd_sessions" TO "anon";
GRANT ALL ON TABLE "public"."dd_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."dd_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."ride_requests" TO "anon";
GRANT ALL ON TABLE "public"."ride_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_requests" TO "service_role";



GRANT ALL ON TABLE "public"."sep_attempts" TO "anon";
GRANT ALL ON TABLE "public"."sep_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."sep_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."sep_baselines" TO "anon";
GRANT ALL ON TABLE "public"."sep_baselines" TO "authenticated";
GRANT ALL ON TABLE "public"."sep_baselines" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































