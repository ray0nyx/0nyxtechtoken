-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  description TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fix the analytics table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics') THEN
    -- Make user_id nullable in the analytics table
    ALTER TABLE analytics ALTER COLUMN user_id DROP NOT NULL;
    
    -- Add a comment to explain the change
    COMMENT ON COLUMN analytics.user_id IS 'User ID, nullable to support system-generated analytics';
    
    -- Create a trigger to automatically set user_id to a system user if it's NULL
    CREATE OR REPLACE FUNCTION set_default_user_id_analytics()
    RETURNS TRIGGER AS $$
    BEGIN
      -- If user_id is NULL, set it to a default system user ID
      IF NEW.user_id IS NULL THEN
        -- Use the first admin user in the system
        SELECT id INTO NEW.user_id FROM auth.users LIMIT 1;
        
        -- If still NULL (no users in system), use a default UUID
        IF NEW.user_id IS NULL THEN
          NEW.user_id := '00000000-0000-0000-0000-000000000000'::uuid;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Create the trigger
    DROP TRIGGER IF EXISTS set_default_user_id_trigger ON analytics;
    CREATE TRIGGER set_default_user_id_trigger
    BEFORE INSERT ON analytics
    FOR EACH ROW
    EXECUTE FUNCTION set_default_user_id_analytics();
    
    -- Log the change
    INSERT INTO migration_log (migration_name, description, executed_at)
    VALUES (
      '20240709000000_fix_analytics_user_id_1',
      'Modified user_id column in analytics table to handle NULL values',
      NOW()
    ) ON CONFLICT DO NOTHING;
  ELSE
    RAISE NOTICE 'Table analytics does not exist, skipping migration';
  END IF;
END
$$;

-- Fix the analytics_table table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_table') THEN
    -- Make user_id nullable in the analytics_table table
    ALTER TABLE analytics_table ALTER COLUMN user_id DROP NOT NULL;
    
    -- Add a comment to explain the change
    COMMENT ON COLUMN analytics_table.user_id IS 'User ID, nullable to support system-generated analytics';
    
    -- Create a trigger to automatically set user_id to a system user if it's NULL
    CREATE OR REPLACE FUNCTION set_default_user_id_analytics_table()
    RETURNS TRIGGER AS $$
    BEGIN
      -- If user_id is NULL, set it to a default system user ID
      IF NEW.user_id IS NULL THEN
        -- Use the first admin user in the system
        SELECT id INTO NEW.user_id FROM auth.users LIMIT 1;
        
        -- If still NULL (no users in system), use a default UUID
        IF NEW.user_id IS NULL THEN
          NEW.user_id := '00000000-0000-0000-0000-000000000000'::uuid;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Create the trigger
    DROP TRIGGER IF EXISTS set_default_user_id_trigger_analytics_table ON analytics_table;
    CREATE TRIGGER set_default_user_id_trigger_analytics_table
    BEFORE INSERT ON analytics_table
    FOR EACH ROW
    EXECUTE FUNCTION set_default_user_id_analytics_table();
    
    -- Log the change
    INSERT INTO migration_log (migration_name, description, executed_at)
    VALUES (
      '20240709000000_fix_analytics_user_id_2',
      'Modified user_id column in analytics_table table to handle NULL values',
      NOW()
    ) ON CONFLICT DO NOTHING;
  ELSE
    RAISE NOTICE 'Table analytics_table does not exist, skipping migration';
  END IF;
END
$$;

-- Create analytics_table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_table') THEN
    CREATE TABLE analytics_table (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      metric_name TEXT NOT NULL,
      date DATE,
      total_trades INTEGER DEFAULT 0,
      total_pnl NUMERIC(20,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Add RLS policies to analytics_table
    ALTER TABLE analytics_table ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Allow read access to authenticated users"
      ON analytics_table
      FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
    
    -- Log the change
    INSERT INTO migration_log (migration_name, description, executed_at)
    VALUES (
      '20240709000000_fix_analytics_user_id_3',
      'Created analytics_table if it did not exist',
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;
END
$$; 