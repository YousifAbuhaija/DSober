-- Fix profile creation trigger to not pre-populate with empty values
-- This migration removes the auto-create trigger and allows the app to create profiles
-- when users actually provide their information

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Update the INSERT policy to allow users to create their own profile
DROP POLICY IF EXISTS "Service role can insert user records" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;

CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- Keep the UPDATE policy for users to update their own records
-- (This should already exist from previous migrations)
