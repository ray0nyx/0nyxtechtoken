// WagYu Account ID Monitor
// This script specifically tracks which account ID is being used during trade uploads

async function monitorTradeUpload(tradeData) {
  console.log("======================================================");
  console.log("WAGYÜ ACCOUNT ID MONITOR");
  console.log("======================================================");
  
  // Use sample data if none provided
  if (!tradeData || !tradeData.length) {
    tradeData = [{
      symbol: 'MNQH5',
      date: '2025-03-12',
      qty: 2,
      entry_price: 19691.5,
      exit_price: 19676.5,
      side: 'short',
      pnl: -30
    }];
    console.log("Using sample trade data:", tradeData);
  }
  
  // Get the current user
  const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error("❌ Authentication error - please log in first.");
    return { success: false, error: sessionError || "No active session" };
  }
  
  const userId = session.user.id;
  console.log("✅ Current user ID:", userId);
  
  // 1. First get all available accounts
  console.log("🔍 Checking available accounts...");
  const { data: accounts, error: accountsError } = await window.supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId);
  
  if (accountsError) {
    console.error("❌ Error fetching accounts:", accountsError);
  } else if (!accounts || accounts.length === 0) {
    console.warn("⚠️ No accounts found for this user. This will cause foreign key errors!");
    
    // Try to create an account
    console.log("Creating a default account...");
    const { data: newAccount, error: createError } = await window.supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: 'Default Account (Auto-created)'
      })
      .select()
      .single();
      
    if (createError) {
      console.error("❌ Failed to create account:", createError);
    } else if (newAccount) {
      console.log("✅ Created new account:", newAccount);
      accounts = [newAccount];
    }
  } else {
    console.log(`✅ Found ${accounts.length} accounts for this user:`);
    accounts.forEach(account => {
      console.log(`   - ID: ${account.id}, Name: ${account.name}`);
    });
  }
  
  // 2. Check if the problematic account ID exists
  const problematicId = '8e290e21-ba83-4533-be0a-718fafcdc7d9';
  const { data: problematicAccount } = await window.supabase
    .from('accounts')
    .select('*')
    .eq('id', problematicId)
    .maybeSingle();
  
  if (problematicAccount) {
    console.log(`✅ The problematic account ID exists in the database:`);
    console.log(`   - ID: ${problematicAccount.id}`);
    console.log(`   - User ID: ${problematicAccount.user_id}`);
    console.log(`   - Name: ${problematicAccount.name}`);
    
    if (problematicAccount.user_id !== userId) {
      console.warn("⚠️ WARNING: This account belongs to a different user!");
    }
  } else {
    console.warn(`⚠️ The problematic account ID (${problematicId}) does NOT exist in the database!`);
  }
  
  // 3. Try each trade upload method sequentially with detailed monitoring
  const results = {
    methods: {},
    success: false,
    usedAccountIds: []
  };
  
  // 3.1. First try with explicit account ID
  if (accounts && accounts.length > 0) {
    const validAccountId = accounts[0].id;
    console.log(`🔍 METHOD 1: Using explicit account ID (${validAccountId})...`);
    
    try {
      const { data, error } = await window.supabase.rpc('process_tradovate_csv_batch', {
        p_user_id: userId,
        p_rows: tradeData,
        p_account_id: validAccountId
      });
      
      results.methods.explicitAccountId = { 
        success: !error, 
        accountId: validAccountId,
        error: error?.message,
        data
      };
      
      if (error) {
        console.error(`❌ METHOD 1 FAILED:`, error.message);
      } else {
        console.log(`✅ METHOD 1 SUCCEEDED with account ID: ${validAccountId}`);
        results.success = true;
        results.usedAccountIds.push(validAccountId);
      }
    } catch (err) {
      console.error(`❌ METHOD 1 EXCEPTION:`, err.message);
      results.methods.explicitAccountId = { 
        success: false, 
        accountId: validAccountId,
        error: err.message
      };
    }
  }
  
  // 3.2. Try with direct function and no explicit account ID
  console.log(`🔍 METHOD 2: Using direct function with no explicit account ID...`);
  
  try {
    const { data, error } = await window.supabase.rpc('process_tradovate_csv_batch_direct', {
      p_user_id: userId,
      p_rows: tradeData
    });
    
    let usedAccountId = null;
    if (data && data.account_id) {
      usedAccountId = data.account_id;
      results.usedAccountIds.push(usedAccountId);
    }
    
    results.methods.directFunction = { 
      success: !error, 
      accountId: usedAccountId,
      error: error?.message,
      data
    };
    
    if (error) {
      console.error(`❌ METHOD 2 FAILED:`, error.message);
    } else {
      console.log(`✅ METHOD 2 SUCCEEDED with account ID: ${usedAccountId}`);
      results.success = true;
    }
  } catch (err) {
    console.error(`❌ METHOD 2 EXCEPTION:`, err.message);
    results.methods.directFunction = { 
      success: false, 
      error: err.message
    };
  }
  
  // 3.3. Try with final process function
  console.log(`🔍 METHOD 3: Using final_process_tradovate_csv_batch function...`);
  
  try {
    const { data, error } = await window.supabase.rpc('final_process_tradovate_csv_batch', {
      p_user_id: userId,
      p_rows: tradeData
    });
    
    let usedAccountId = null;
    if (data && data.account_id) {
      usedAccountId = data.account_id;
      results.usedAccountIds.push(usedAccountId);
    }
    
    results.methods.finalProcess = { 
      success: !error, 
      accountId: usedAccountId,
      error: error?.message,
      data
    };
    
    if (error) {
      console.error(`❌ METHOD 3 FAILED:`, error.message);
    } else {
      console.log(`✅ METHOD 3 SUCCEEDED with account ID: ${usedAccountId}`);
      results.success = true;
    }
  } catch (err) {
    console.error(`❌ METHOD 3 EXCEPTION:`, err.message);
    results.methods.finalProcess = { 
      success: false, 
      error: err.message
    };
  }
  
  // 4. Try direct guaranteed account ID function
  console.log(`🔍 METHOD 4: Getting guaranteed account ID directly...`);
  
  try {
    const { data, error } = await window.supabase.rpc('get_guaranteed_account_id', {
      p_user_id: userId
    });
    
    results.methods.guaranteedAccountId = { 
      success: !error, 
      accountId: data,
      error: error?.message 
    };
    
    if (error) {
      console.error(`❌ METHOD 4 FAILED:`, error.message);
    } else {
      console.log(`✅ METHOD 4 SUCCEEDED, returned account ID: ${data}`);
      if (data) results.usedAccountIds.push(data);
    }
  } catch (err) {
    console.error(`❌ METHOD 4 EXCEPTION:`, err.message);
    results.methods.guaranteedAccountId = { 
      success: false, 
      error: err.message
    };
  }
  
  // 5. Summarize results
  console.log("======================================================");
  console.log("ACCOUNT ID MONITORING RESULTS");
  console.log("======================================================");
  
  console.log(`User ID: ${userId}`);
  console.log(`Available Accounts: ${accounts ? accounts.length : 0}`);
  
  if (accounts && accounts.length > 0) {
    console.log("Account IDs:", accounts.map(a => a.id).join(", "));
  }
  
  console.log(`Problematic Account Exists: ${problematicAccount ? 'YES' : 'NO'}`);
  console.log(`Overall Success: ${results.success ? 'YES' : 'NO'}`);
  console.log(`Account IDs Used: ${results.usedAccountIds.join(", ")}`);
  
  // Look for foreign key constraint errors specifically
  const hasForeignKeyError = Object.values(results.methods).some(
    method => method.error && method.error.includes("trades_account_id_fkey")
  );
  
  if (hasForeignKeyError) {
    console.error("❌ FOREIGN KEY CONSTRAINT VIOLATION DETECTED!");
    console.log("This means one of the following:");
    console.log("1. An account ID is being used that doesn't exist in the database");
    console.log("2. The account exists but belongs to a different user");
    console.log("3. The database constraints are preventing the use of the expected account");
  }
  
  return {
    success: results.success,
    userId,
    accounts: accounts || [],
    problematicAccountExists: !!problematicAccount,
    usedAccountIds: results.usedAccountIds,
    methods: results.methods,
    hasForeignKeyError
  };
}

// Helper function to diagnose account ID issues
async function diagnoseAccountIdIssue() {
  const { data: { session } } = await window.supabase.auth.getSession();
  
  if (!session) {
    console.error("❌ No active session. Please log in first.");
    return { success: false, error: "No active session" };
  }
  
  const userId = session.user.id;
  console.log("Current user ID:", userId);
  
  // Check all trades for invalid account IDs
  console.log("Checking for trades with invalid account IDs...");
  
  // This query doesn't actually join with accounts, it just returns the data
  // We'll check validity client-side
  const { data: trades, error: tradesError } = await window.supabase
    .from('trades')
    .select('id, symbol, account_id, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(100);
  
  if (tradesError) {
    console.error("❌ Error fetching trades:", tradesError);
    return { success: false, error: tradesError };
  }
  
  if (!trades || trades.length === 0) {
    console.log("ℹ️ No trades found for this user.");
    return { success: true, trades: [] };
  }
  
  console.log(`Found ${trades.length} trades.`);
  
  // Get all accounts
  const { data: accounts, error: accountsError } = await window.supabase
    .from('accounts')
    .select('id');
  
  if (accountsError) {
    console.error("❌ Error fetching accounts:", accountsError);
    return { success: false, error: accountsError };
  }
  
  // Convert accounts to a Set for faster lookups
  const validAccountIds = new Set(accounts.map(a => a.id));
  
  // Find trades with invalid account IDs
  const invalidTrades = trades.filter(trade => !validAccountIds.has(trade.account_id));
  
  if (invalidTrades.length > 0) {
    console.error(`❌ Found ${invalidTrades.length} trades with invalid account IDs:`);
    invalidTrades.forEach(trade => {
      console.error(`   - Trade ID: ${trade.id}, Symbol: ${trade.symbol}, Invalid Account ID: ${trade.account_id}`);
    });
    
    // Group by invalid account ID to see patterns
    const accountGroups = {};
    invalidTrades.forEach(trade => {
      accountGroups[trade.account_id] = (accountGroups[trade.account_id] || 0) + 1;
    });
    
    console.log("Invalid account IDs usage frequency:");
    Object.entries(accountGroups).forEach(([accountId, count]) => {
      console.log(`   - ${accountId}: ${count} trades`);
    });
  } else {
    console.log("✅ All trades have valid account IDs!");
  }
  
  return {
    success: true,
    trades,
    validAccountIds: Array.from(validAccountIds),
    invalidTrades,
    totalTrades: trades.length,
    totalInvalidTrades: invalidTrades.length
  };
}

// Display help
console.log(`
======================================================
WAGYÜ ACCOUNT ID MONITOR TOOL
======================================================

This tool helps diagnose account ID foreign key issues by showing
exactly which account ID is being used during trade uploads.

1. Track a trade upload with detailed account ID monitoring:
   monitorTradeUpload()

2. Check your trades for invalid account IDs:
   diagnoseAccountIdIssue()

For example:
   monitorTradeUpload().then(result => console.log("Final result:", result))

======================================================
`); 