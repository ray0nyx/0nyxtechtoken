// This script helps migrate existing users' preferences to the new user_settings table
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (replace with your project URL and anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateUserSettings() {
  try {
    console.log('Starting user settings migration...');
    
    // Fetch all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw usersError;
    }
    
    console.log(`Found ${users.length} users to process`);
    
    // For each user, create a default settings entry
    for (const user of users) {
      console.log(`Processing user: ${user.email}`);
      
      // Check if settings already exist
      const { data: existingSettings, error: settingsCheckError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (settingsCheckError && settingsCheckError.code !== 'PGRST116') {
        console.error(`Error checking settings for user ${user.email}:`, settingsCheckError);
        continue;
      }
      
      // Skip if settings already exist
      if (existingSettings) {
        console.log(`Settings already exist for user ${user.email}, skipping`);
        continue;
      }
      
      // Create default settings
      // Try to detect theme preference from user metadata if available
      const prefersDarkMode = user.user_metadata?.theme === 'dark';
      
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          dark_mode: prefersDarkMode,
          notifications: true,
          email_alerts: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (insertError) {
        console.error(`Error creating settings for user ${user.email}:`, insertError);
        continue;
      }
      
      console.log(`Successfully created settings for user ${user.email}`);
    }
    
    console.log('User settings migration completed!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateUserSettings(); 