-- Create bar_replay_templates table for saving user chart color templates
-- This migration creates the table for storing bar replay chart color templates

CREATE TABLE IF NOT EXISTS bar_replay_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bar_replay_templates_user_id ON bar_replay_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_bar_replay_templates_name ON bar_replay_templates(name);
CREATE INDEX IF NOT EXISTS idx_bar_replay_templates_created_at ON bar_replay_templates(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE bar_replay_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own bar replay templates" ON bar_replay_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bar replay templates" ON bar_replay_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bar replay templates" ON bar_replay_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bar replay templates" ON bar_replay_templates
  FOR DELETE USING (auth.uid() = user_id);
