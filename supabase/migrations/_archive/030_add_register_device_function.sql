-- Create a function to register devices that bypasses RLS
-- This is needed because device registration happens during auth initialization
-- and auth.uid() might not be properly set yet

CREATE OR REPLACE FUNCTION register_user_device(
  p_user_id UUID,
  p_expo_push_token TEXT,
  p_device_name TEXT,
  p_device_os TEXT,
  p_app_version TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is the user they claim to be
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot register device for another user';
  END IF;

  -- Upsert the device record
  INSERT INTO user_devices (
    user_id,
    expo_push_token,
    device_name,
    device_os,
    app_version,
    is_active,
    last_used_at
  )
  VALUES (
    p_user_id,
    p_expo_push_token,
    p_device_name,
    p_device_os,
    p_app_version,
    true,
    NOW()
  )
  ON CONFLICT (expo_push_token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_name = EXCLUDED.device_name,
    device_os = EXCLUDED.device_os,
    app_version = EXCLUDED.app_version,
    is_active = true,
    last_used_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION register_user_device(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
