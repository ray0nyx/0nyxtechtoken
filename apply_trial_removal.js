// Script to apply the trial removal migration
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nlctxawkutljeimvjacp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3R4YXdrdXRsamVpbXZqYWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0NzA1ODAsImV4cCI6MjA0MTA0NjU4MH0.Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Applying trial removal migration...');
    
    // Update existing trial users to pending status
    const { data, error } = await supabase
      .from('user_subscriptions')
      .update({ 
        status: 'pending', 
        access_level: 'no_access' 
      })
      .eq('status', 'trial');
    
    if (error) {
      console.error('Error updating trial users:', error);
    } else {
      console.log('Successfully updated trial users to pending status');
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

applyMigration();
