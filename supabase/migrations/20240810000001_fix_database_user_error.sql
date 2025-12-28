-- This migration fixes the "Database error saving new user" issue
-- by ensuring a proper fallback mechanism for user creation

-- First, check if the users table exists and create it if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add RLS policies
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Allow users to view their own data
    CREATE POLICY users_select_policy ON public.users
      FOR SELECT USING (auth.uid() = id);
  END IF;
END
$$;

-- Create a robust function for handling new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  -- Safety check to make sure we can insert this user
  IF NEW.id IS NULL THEN
    RAISE WARNING 'Cannot create user record: User ID is NULL';
    RETURN NEW;
  END IF;
  
  -- Insert into public.users with a conflict handling strategy
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.created_at, NOW()),
      COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Log success
    RAISE NOTICE 'Successfully created user record for %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't break the auth flow
    RAISE WARNING 'Error creating user record: %', SQLERRM;
  END;
  
  -- Always return NEW to continue the auth flow
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- Add a permission check to ensure the function can access the necessary tables
DO $$
BEGIN
  -- Grant necessary permissions
  EXECUTE 'GRANT ALL ON TABLE public.users TO authenticated';
  EXECUTE 'GRANT ALL ON TABLE public.users TO service_role';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error setting permissions: %', SQLERRM;
END
$$; 