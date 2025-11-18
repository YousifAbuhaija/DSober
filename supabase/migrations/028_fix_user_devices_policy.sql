-- Fix user_devices INSERT policy
-- The issue might be with the upsert operation

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own devices" ON user_devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON user_devices;

-- Recreate INSERT policy - must match user_id with auth.uid()
CREATE POLICY "Users can insert their own devices"
  ON user_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Recreate UPDATE policy to allow upsert
CREATE POLICY "Users can update their own devices"
  ON user_devices
  FOR UPDATE
  USING (auth.uid() = user_id OR expo_push_token IN (
    SELECT expo_push_token FROM user_devices WHERE user_id = auth.uid()
  ))
  WITH CHECK (auth.uid() = user_id);

