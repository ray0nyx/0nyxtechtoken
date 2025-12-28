-- Create user_settings table for persistent user preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dark_mode BOOLEAN DEFAULT false,
    notifications BOOLEAN DEFAULT true,
    email_alerts BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Add RLS policies to secure the user_settings table
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view only their own settings
CREATE POLICY "Users can view their own settings" 
ON user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy to allow users to insert their own settings
CREATE POLICY "Users can insert their own settings" 
ON user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own settings
CREATE POLICY "Users can update their own settings" 
ON user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id); 