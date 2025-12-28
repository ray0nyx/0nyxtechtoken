// Script to create bar_replay_templates table
// Run this with: node create_bar_replay_templates_table.js

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables or replace with your actual values
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  try {
    console.log('Creating bar_replay_templates table...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS bar_replay_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          settings JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, name)
        );
        
        CREATE INDEX IF NOT EXISTS idx_bar_replay_templates_user_id ON bar_replay_templates(user_id);
        CREATE INDEX IF NOT EXISTS idx_bar_replay_templates_name ON bar_replay_templates(name);
        CREATE INDEX IF NOT EXISTS idx_bar_replay_templates_updated_at ON bar_replay_templates(updated_at DESC);
        
        ALTER TABLE bar_replay_templates ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own bar replay templates" ON bar_replay_templates
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert their own bar replay templates" ON bar_replay_templates
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own bar replay templates" ON bar_replay_templates
          FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own bar replay templates" ON bar_replay_templates
          FOR DELETE USING (auth.uid() = user_id);
      `
    });
    
    if (error) {
      console.error('Error creating table:', error);
    } else {
      console.log('Table created successfully!');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

createTable();
