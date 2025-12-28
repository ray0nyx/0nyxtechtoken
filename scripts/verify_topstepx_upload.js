// Test script to verify TopstepX upload functionality works without account selection
// Run this script in Node.js after applying the SQL fix to verify it works correctly

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sample trade data (minimal required fields)
const sampleTrades = [
  {
    contract_name: 'ES',
    entry_price: 4200.50,
    exit_price: 4210.25,
    size: 1,
    type: 'long',
    entered_at: new Date().toISOString(),
    exited_at: new Date().toISOString(),
    trade_day: new Date().toISOString().split('T')[0],
    fees: 2.50,
    platform: 'topstepx'
  }
];

// Test the upload functionality
async function testTopstepXUpload() {
  console.log('Verifying TopstepX upload functionality...');
  
  try {
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Authentication error:', sessionError.message);
      console.log('Please sign in first and try again.');
      return false;
    }
    
    if (!session || !session.user) {
      console.error('No active session found. Please log in first.');
      return false;
    }
    
    const userId = session.user.id;
    console.log(`Testing with user ID: ${userId}`);

    // For each trade, set the user ID
    const tradesWithUserId = sampleTrades.map(trade => ({
      ...trade,
      user_id: userId
    }));
    
    // Call the function directly with the right parameters
    const { data, error } = await supabase.rpc(
      'process_topstepx_csv_batch',
      {
        p_user_id: userId,
        p_rows: tradesWithUserId,
        p_account_id: null // This is the key part - we don't provide an account ID
      }
    );
    
    if (error) {
      console.error('Error uploading trades:', error.message);
      console.error('Details:', error);
      return false;
    }
    
    console.log('Upload response:', data);
    
    if (data && data.success) {
      console.log('✅ Success! The TopstepX upload works without requiring account selection.');
      console.log(`Processed ${data.processed} trades`);
      console.log(`Used account ID: ${data.account_id}`);
      return true;
    } else {
      console.error('❌ Upload failed:', data?.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('Unexpected error during test:', error);
    return false;
  }
}

// Run the test
testTopstepXUpload()
  .then(success => {
    console.log('\nTest completed.');
    if (success) {
      console.log('The fix has been successfully applied! You can now upload TopstepX trades without selecting an account.');
    } else {
      console.log('The fix might not be working correctly. Please check the SQL script and try again.');
    }
  })
  .catch(error => {
    console.error('Fatal error during test execution:', error);
  }); 