-- Fix foreign key constraint to be deferrable
-- This allows the trigger to work properly within the same transaction

-- Drop the existing foreign key constraint
ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Recreate it as DEFERRABLE INITIALLY DEFERRED
-- This means the constraint is checked at the end of the transaction
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Verify the trigger exists and recreate if needed
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
  -- Get email from auth user
  user_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    ''
  );

  -- Insert the user profile
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
    -- Log the error
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
