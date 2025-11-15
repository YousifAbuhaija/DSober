-- Final fix: Bypass RLS for trigger inserts
-- SECURITY DEFINER functions in Supabase still respect RLS
-- We need to grant explicit bypass or use a service role approach

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
DROP POLICY IF EXISTS "Service role can insert user records" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert user records" ON users;

-- Grant the authenticator role (used by triggers) permission to bypass RLS for inserts
GRANT INSERT ON public.users TO postgres;
GRANT INSERT ON public.users TO service_role;

-- Recreate the trigger function with proper grants
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    ''
  );

  -- Use a direct INSERT that bypasses RLS via SECURITY DEFINER
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
    user_email,
    '',
    CURRENT_DATE,
    '',
    NULL,
    'member',
    false
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Keep the SELECT and UPDATE policies
DROP POLICY IF EXISTS "Users can read their own record" ON users;
CREATE POLICY "Users can read their own record"
  ON users FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can read users in same group" ON users;
CREATE POLICY "Users can read users in same group"
  ON users FOR SELECT
  USING (group_id = public.get_user_group_id());

DROP POLICY IF EXISTS "Users can update their own record" ON users;
CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
