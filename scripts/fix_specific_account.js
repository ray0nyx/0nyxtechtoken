// Fix Specific Account Issue Script
// Run this in the browser console to fix the account ID foreign key issue

async function fixSpecificAccountIssue() {
  console.log("========== FIX SPECIFIC ACCOUNT ISSUE ==========");
  
  // The problematic account ID
  const invalidAccountId = '8e290e21-ba83-4533-be0a-718fafcdc7d9';
  
  // 1. Get the current user
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
  } else {
    if (!accounts || accounts.length === 0) {
      console.log("ℹ️ No accounts found for this user. Will create one during fix.");
    } else {
      console.log(`✅ Found ${accounts.length} existing accounts for this user:`);
      accounts.forEach(account => {
        console.log(`   - ID: ${account.id}, Name: ${account.name}, Created: ${account.created_at}`);
      });
    }
  }
  
  // 3. Check if any of the user's trades use the problematic account ID
  const { data: trades, error: tradesError } = await window.supabase
    .from('trades')
    .select('id, symbol, quantity, timestamp')
    .eq('user_id', userId)
    .eq('account_id', invalidAccountId)
    .limit(10);
  
  if (tradesError) {
    console.error("❌ Error checking trades:", tradesError);
  } else {
    if (!trades || trades.length === 0) {
      console.log("ℹ️ No trades found using the invalid account ID for this user.");
    } else {
      console.log(`⚠️ Found ${trades.length} trades using the invalid account ID:`);
      trades.forEach(trade => {
        console.log(`   - ID: ${trade.id}, Symbol: ${trade.symbol}, Qty: ${trade.quantity}`);
      });
    }
  }
  
  // 4. Call the fix function
  console.log("Calling fix function to repair trades with invalid account ID...");
  
  try {
    const { data: fixResult, error: fixError } = await window.supabase
      .rpc('fix_trades_with_invalid_account', {
        p_user_id: userId,
        p_invalid_account_id: invalidAccountId
      });
    
    if (fixError) {
      console.error("❌ Error fixing trades:", fixError);
      return { 
        success: false, 
        error: fixError,
        userId,
        invalidAccountId
      };
    } else {
      console.log("✅ Fix result:", fixResult);
      
      if (fixResult.trades_fixed > 0) {
        console.log(`✅ Successfully fixed ${fixResult.trades_fixed} trades to use account ID: ${fixResult.valid_account_id}`);
      } else {
        console.log("ℹ️ No trades needed fixing for this user.");
      }
      
      return {
        success: true,
        userId,
        invalidAccountId,
        fixResult,
        message: `Fixed ${fixResult.trades_fixed} trades with invalid account ID.`
      };
    }
  } catch (err) {
    console.error("❌ Exception fixing trades:", err);
    return { 
      success: false, 
      error: err.message,
      userId,
      invalidAccountId
    };
  }
}

// Function to test uploading a trade after fixing the account issue
async function testTradeAfterFix() {
  console.log("========== TESTING TRADE AFTER FIX ==========");
  
  const { data: { session } } = await window.supabase.auth.getSession();
  
  if (!session) {
    console.error("❌ No active session. User is not logged in.");
    return { success: false, error: "No active session" };
  }
  
  const userId = session.user.id;
  console.log("✅ Current user ID:", userId);
  
  // Get valid account ID
  const { data: accounts } = await window.supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  const validAccountId = accounts && accounts.length > 0 ? accounts[0].id : null;
  console.log("Using account ID:", validAccountId || "Will be created automatically");
  
  // Create a test trade
  const trade = [{
    symbol: 'MNQH5',
    date: '2025-03-12',
    qty: 2,
    entry_price: 19691.5,
    exit_price: 19676.5,
    side: 'short',
    pnl: -30
  }];
  
  // Try with direct batch function
  console.log("Testing fixed function with test trade...");
  
  try {
    const { data: result, error } = await window.supabase
      .rpc('process_tradovate_csv_batch_direct', {
        p_user_id: userId,
        p_rows: trade
      });
    
    if (error) {
      console.error("❌ Trade upload error:", error);
      console.error("Error details:", error.message);
      
      // Extract constraint name if it's a constraint violation
      const constraintMatch = error.message.match(/constraint "([^"]+)"/);
      if (constraintMatch) {
        console.error("Constraint violation:", constraintMatch[1]);
      }
      
      return {
        success: false,
        error,
        userId,
        validAccountId
      };
    } else {
      console.log("✅ Trade upload successful:", result);
      
      return {
        success: true,
        result,
        userId,
        validAccountId,
        message: "Successfully uploaded test trade after fix"
      };
    }
  } catch (err) {
    console.error("❌ Exception uploading trade:", err);
    return {
      success: false,
      error: err.message,
      userId,
      validAccountId
    };
  }
}

// Print help instructions
console.log(`
=================================================================
WagYu Account Fix Tool
=================================================================
Available functions:

1. fixSpecificAccountIssue() - Fix trades using the invalid account ID
2. testTradeAfterFix() - Test uploading a trade after fixing the account issue

Example usage:
  fixSpecificAccountIssue().then(result => console.log("Final result:", result));
  
  // After fixing, test a trade upload:
  testTradeAfterFix().then(result => console.log("Test result:", result));
=================================================================
`); 