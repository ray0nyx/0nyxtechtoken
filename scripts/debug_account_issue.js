// Account Debugging Script for WagYu
// Run this in the browser console to diagnose account issues

async function debugAccountIssue() {
  console.log("========== ACCOUNT DEBUG SCRIPT ==========");
  
  // 1. Check current user
  const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
  
  if (sessionError) {
    console.error("❌ Authentication error:", sessionError);
    return { success: false, error: sessionError };
  }
  
  if (!session) {
    console.error("❌ No active session. User is not logged in.");
    return { success: false, error: "No active session" };
  }
  
  const userId = session.user.id;
  console.log("✅ Current user ID:", userId);
  
  // 2. Check existing accounts
  const { data: accounts, error: accountsError } = await window.supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId);
  
  if (accountsError) {
    console.error("❌ Error fetching accounts:", accountsError);
    return { success: false, error: accountsError };
  }
  
  if (!accounts || accounts.length === 0) {
    console.log("ℹ️ No accounts found for this user.");
  } else {
    console.log(`✅ Found ${accounts.length} accounts for this user:`);
    accounts.forEach(account => {
      console.log(`   - ID: ${account.id}, Name: ${account.name}, Created: ${account.created_at}`);
    });
  }
  
  // 3. Try to call the verification function
  console.log("Calling verification function...");
  try {
    const { data: verifyResult, error: verifyError } = await window.supabase
      .rpc('verify_user_and_create_account');
    
    if (verifyError) {
      console.error("❌ Verification function error:", verifyError);
    } else {
      console.log("✅ Verification result:", verifyResult);
    }
  } catch (err) {
    console.error("❌ Exception calling verification function:", err);
  }
  
  // 4. Try a test trade upload
  console.log("Testing trade upload with a single test trade...");
  
  const testTrade = [{
    symbol: 'TEST',
    side: 'buy',
    qty: 1,
    date: new Date().toISOString().split('T')[0],
    entry_price: 100,
    exit_price: 110,
    pnl: 10
  }];
  
  try {
    const { data: testResult, error: testError } = await window.supabase
      .rpc('test_trade_upload', {
        p_user_id: userId
      });
    
    if (testError) {
      console.error("❌ Test trade upload error:", testError);
    } else {
      console.log("✅ Test trade upload result:", testResult);
    }
  } catch (err) {
    console.error("❌ Exception testing trade upload:", err);
  }
  
  // 5. Try direct trade batch function
  console.log("Testing direct trade batch function...");
  
  try {
    const { data: directResult, error: directError } = await window.supabase
      .rpc('process_tradovate_csv_batch_direct', {
        p_user_id: userId,
        p_rows: testTrade
      });
    
    if (directError) {
      console.error("❌ Direct trade batch error:", directError);
    } else {
      console.log("✅ Direct trade batch result:", directResult);
    }
  } catch (err) {
    console.error("❌ Exception calling direct trade batch:", err);
  }
  
  return {
    success: true,
    userId,
    accounts: accounts || [],
    message: "Debug complete. Check console for detailed results."
  };
}

// Function to test uploading the problematic MNQH5 trade
async function testProblematicTrade() {
  console.log("========== TESTING PROBLEMATIC TRADE ==========");
  
  const { data: { session } } = await window.supabase.auth.getSession();
  
  if (!session) {
    console.error("❌ No active session. User is not logged in.");
    return { success: false, error: "No active session" };
  }
  
  const userId = session.user.id;
  console.log("✅ Current user ID:", userId);
  
  // Create the problematic trade
  const trade = [{
    symbol: 'MNQH5',
    date: '2025-03-12',
    qty: 2,
    entry_price: 19691.5,
    exit_price: 19676.5,
    side: 'short',  // Try with explicit side
    pnl: -30  // Calculated PnL for this example
  }];
  
  // Try with process_tradovate_csv_batch_direct
  console.log("Testing direct function with problematic trade...");
  
  try {
    const { data: directResult, error: directError } = await window.supabase
      .rpc('process_tradovate_csv_batch_direct', {
        p_user_id: userId,
        p_rows: trade
      });
    
    if (directError) {
      console.error("❌ Direct trade batch error:", directError);
      console.error("Error details:", directError.message);
      
      // Extract constraint name if it's a constraint violation
      const constraintMatch = directError.message.match(/constraint "([^"]+)"/);
      if (constraintMatch) {
        console.error("Constraint violation:", constraintMatch[1]);
      }
    } else {
      console.log("✅ Direct trade batch result:", directResult);
      
      // Check if there were any per-row errors
      if (directResult.errors > 0) {
        console.warn("⚠️ Some rows had errors. Check the results array.");
        directResult.results.forEach((result, index) => {
          if (!result.success) {
            console.error(`Row ${index} error:`, result.error);
          }
        });
      }
    }
    
    return {
      success: !directError,
      result: directResult,
      error: directError
    };
  } catch (err) {
    console.error("❌ Exception calling direct trade batch:", err);
    return {
      success: false,
      error: err.message
    };
  }
}

// Legacy function for compatibility
async function testTradeUpload() {
  return debugAccountIssue();
}

// Print help instructions
console.log(`
=================================================================
WagYu Trade Upload Diagnostics
=================================================================
Available functions:

1. debugAccountIssue() - Run comprehensive diagnostics on accounts
2. testProblematicTrade() - Test the specific MNQH5 trade that fails
3. testTradeUpload() - Alias for debugAccountIssue (for compatibility)

Example usage:
  debugAccountIssue().then(result => console.log("Final result:", result));
=================================================================
`); 