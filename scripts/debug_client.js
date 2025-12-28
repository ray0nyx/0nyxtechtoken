// Debug client for testing trade uploads
// This script can be run in the browser console to test the trade upload functionality

async function testTradeUpload() {
  // Sample trade data in the exact format from your application
  const sampleTrades = [
    {
      symbol: 'MNQH5',
      date: '2025-03-12',
      qty: 2,
      entry_price: 19691.5,
      exit_price: 19676.5,
      pnl: -30,
      side: 'long'
    }
  ];

  console.log('Testing trade upload with sample trade:', sampleTrades[0]);

  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return;
    }
    
    console.log('Authenticated as user:', user.id);
    
    // Call the debug function instead of the regular one
    const { data, error } = await supabase.rpc('process_tradovate_csv_batch_debug', {
      p_user_id: user.id,
      p_rows: sampleTrades
    });
    
    console.log('Server response:', data);
    
    if (error) {
      console.error('Error from server:', error);
    } else {
      console.log('Success count:', data.processed);
      console.log('Error count:', data.errors);
      
      // Check individual results
      if (data.results && data.results.length > 0) {
        data.results.forEach((result, index) => {
          if (result.success) {
            console.log(`Trade ${index} processed successfully:`, result);
          } else {
            console.error(`Trade ${index} failed:`, result.error);
          }
        });
      }
    }
  } catch (err) {
    console.error('Exception during trade upload:', err);
  }
}

// Function to test with the exact format from your application
async function testWithActualFormat() {
  // Get the trades from your application
  // This assumes you have the trades available in a variable or can extract them
  // Replace this with how you actually get the trades in your application
  const trades = [
    {
      symbol: 'MNQH5',
      date: '2025-03-12',
      qty: 2,
      entry_price: 19691.5,
      exit_price: 19676.5,
      pnl: -30,
      side: 'long'
    }
    // Add more trades if needed
  ];
  
  console.log('Testing with actual format, sample trade:', trades[0]);
  console.log('Total trades to send:', trades.length);
  
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return;
    }
    
    // Call the debug function
    const { data, error } = await supabase.rpc('process_tradovate_csv_batch_debug', {
      p_user_id: user.id,
      p_rows: trades
    });
    
    console.log('Server response:', data);
    
    if (error) {
      console.error('Error from server:', error);
    }
  } catch (err) {
    console.error('Exception during trade upload:', err);
  }
}

// Instructions for use:
// 1. Open your application in the browser
// 2. Open the browser console (F12 or right-click -> Inspect -> Console)
// 3. Copy and paste this entire script into the console
// 4. Run one of these functions:
//    - testTradeUpload() - to test with a sample trade
//    - testWithActualFormat() - to test with the actual format from your application
//
// Example:
// testTradeUpload() 