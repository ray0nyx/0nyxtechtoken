const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

async function updateUser() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://txzvrwthvylydrmwfuye.supabase.co';
  const supabaseKey = process.env.SUPABASE_ADMIN_KEY;
  
  if (!supabaseKey) {
    console.error('Missing SUPABASE_ADMIN_KEY environment variable');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const userId = '8538e0b7-6dcd-4673-b39f-00d273c7fc76';
  
  // Calculate trial end date (7 days from now)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);
  
  // First check if the user subscription exists
  const { data: existingSubscription } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single();
    
  if (existingSubscription) {
    // Update existing subscription
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'trialing',
        is_developer: false,
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error updating subscription:', error);
    } else {
      console.log('Successfully updated user to trial status until', trialEndDate);
    }
  } else {
    // Create new subscription
    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        id: uuidv4(),
        user_id: userId,
        status: 'trialing',
        is_developer: false,
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('Error creating subscription:', error);
    } else {
      console.log('Successfully created trial subscription until', trialEndDate);
    }
  }
  
  // Also update the developer bypass list in the SubscriptionContext
  console.log('NOTE: You must also remove this user from the developerIds array in src/contexts/SubscriptionContext.tsx')
}

updateUser().catch(console.error);
