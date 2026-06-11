-- Auto-create user profile on signup using trigger
-- This migration creates a trigger that automatically creates a user profile
-- when a new user signs up via Supabase Auth

-- First, drop the restrictive INSERT policy since we'll use a trigger instead
DROP POLICY IF EXISTS "Users can insert their own record" ON users;

-- Create a function that will be triggered on new auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    birthday,
    gender,
    group_id,
    role,
    is_dd
  )
  VALUES (
    NEW.id,
    NEW.email,
    '',
    CURRENT_DATE,
    '',
    NULL,
    'member',
    false
  );
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Now create a simpler INSERT policy for manual profile updates (if needed)
CREATE POLICY "Service role can insert user records"
  ON users FOR INSERT
  WITH CHECK (true);

-- Keep the UPDATE policy for users to update their own records
DROP POLICY IF EXISTS "Users can update their own record" ON users;
CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
