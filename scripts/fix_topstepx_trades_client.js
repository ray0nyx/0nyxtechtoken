/**
 * FIX TOPSTEPX TRADES CLIENT SCRIPT
 * 
 * This script helps fix trades with NULL account_id values so they show up
 * in the trades page, analytics, and performance pages.
 * 
 * To use:
 * 1. Open your browser console on any page of the app
 * 2. Copy and paste this entire script
 * 3. Run fixTradesAccountId() function
 */

/**
 * Fix trades with NULL account_id values
 */
async function fixTradesAccountId() {
  console.log('Starting fix for trades with NULL account_id values...');
  
  try {
    // Check user authentication
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.error('Error: You must be logged in to fix trades');
      return { success: false, error: 'Not authenticated' };
    }
    
    // Option 1: Call the RPC function (preferred)
    console.log('Calling fix_null_account_trades RPC function...');
    const { data: rpcResult, error: rpcError } = await window.supabase.rpc('fix_null_account_trades');
    
    if (rpcError) {
      console.error('Error calling fix_null_account_trades:', rpcError);
      console.log('Falling back to direct fix method...');
    } else {
      console.log('RPC function result:', rpcResult);
      if (rpcResult.success) {
        console.log(`✅ Success! Fixed ${rpcResult.fixed_count} trades`);
        return rpcResult;
      }
    }
    
    // Option 2: Direct fix if RPC fails
    console.log('Performing direct fix...');
    
    // Step 1: Get user ID
    const userId = session.user.id;
    console.log('Current user ID:', userId);
    
    // Step 2: Count trades with NULL account_id
    const { data: nullTrades, error: countError } = await window.supabase
      .from('trades')
      .select('id')
      .is('account_id', null)
      .eq('user_id', userId);
    
    if (countError) {
      console.error('Error counting NULL account_id trades:', countError);
      return { success: false, error: countError.message };
    }
    
    if (!nullTrades || nullTrades.length === 0) {
      console.log('✅ No trades with NULL account_id found');
      return { success: true, message: 'No trades with NULL account_id found', fixed_count: 0 };
    }
    
    console.log(`Found ${nullTrades.length} trades with NULL account_id`);
    
    // Step 3: Get or create a trading account
    let accountId;
    
    // Try to find an existing account
    const { data: existingAccounts, error: accountError } = await window.supabase
      .from('trading_accounts')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    
    if (accountError) {
      console.error('Error finding existing trading account:', accountError);
      return { success: false, error: accountError.message };
    }
    
    if (existingAccounts && existingAccounts.length > 0) {
      accountId = existingAccounts[0].id;
      console.log('Using existing trading account:', accountId);
    } else {
      // Create a new trading account
      const { data: newAccount, error: createError } = await window.supabase
        .from('trading_accounts')
        .insert([
          {
            user_id: userId,
            name: 'Default Trading Account',
            created_at: new Date().toISOString()
          }
        ])
        .select('id')
        .single();
      
      if (createError) {
        console.error('Error creating trading account:', createError);
        return { success: false, error: createError.message };
      }
      
      accountId = newAccount.id;
      console.log('Created new trading account:', accountId);
    }
    
    // Step 4: Update trades with the valid account_id
    const { data: updateResult, error: updateError } = await window.supabase
      .from('trades')
      .update({ 
        account_id: accountId,
        updated_at: new Date().toISOString()
      })
      .is('account_id', null)
      .eq('user_id', userId);
    
    if (updateError) {
      console.error('Error updating trades:', updateError);
      return { success: false, error: updateError.message };
    }
    
    console.log(`✅ Success! Fixed ${nullTrades.length} trades with account_id: ${accountId}`);
    return { 
      success: true, 
      message: 'Successfully fixed trades with NULL account_id',
      fixed_count: nullTrades.length,
      account_id: accountId 
    };
  } catch (err) {
    console.error('Unexpected error in fixTradesAccountId:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Verify trades are visible
 */
async function verifyTradesVisible() {
  console.log('Verifying trades are now visible...');
  
  try {
    // Check user authentication
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.error('Error: You must be logged in to verify trades');
      return { success: false, error: 'Not authenticated' };
    }
    
    // Get user ID
    const userId = session.user.id;
    
    // Count total trades for this user
    const { data: allTrades, error: allError } = await window.supabase
      .from('trades')
      .select('id, account_id')
      .eq('user_id', userId);
    
    if (allError) {
      console.error('Error counting total trades:', allError);
      return { success: false, error: allError.message };
    }
    
    // Count trades with NULL account_id
    const nullTrades = allTrades.filter(t => t.account_id === null);
    
    // Count trades with invalid account_id
    const { data: orphanedCount, error: orphanedError } = await window.supabase.rpc(
      'count_orphaned_trades'
    ).maybeSingle();
    
    if (orphanedError) {
      console.warn('Unable to check for orphaned trades:', orphanedError);
    }
    
    console.log('Verification results:');
    console.log('- Total trades:', allTrades.length);
    console.log('- Trades with NULL account_id:', nullTrades.length);
    console.log('- Orphaned trades (invalid account_id):', orphanedCount || 'Unknown');
    
    if (nullTrades.length === 0 && (!orphanedCount || orphanedCount === 0)) {
      console.log('✅ All trades should now be visible in the interface');
      return {
        success: true,
        message: 'All trades should now be visible',
        total_trades: allTrades.length
      };
    } else {
      console.log('⚠️ Some trades may still not be visible');
      return {
        success: false,
        message: 'Some trades may still not be visible',
        null_account_trades: nullTrades.length,
        orphaned_trades: orphanedCount || 0
      };
    }
  } catch (err) {
    console.error('Unexpected error in verifyTradesVisible:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create count_orphaned_trades function if it doesn't exist
 */
async function createOrphanedTradesFunction() {
  try {
    // Call the function to see if it exists
    const { data, error } = await window.supabase.rpc('count_orphaned_trades');
    
    if (!error || !error.message.includes('does not exist')) {
      console.log('count_orphaned_trades function already exists');
      return true;
    }
    
    console.log('Creating count_orphaned_trades function...');
    
    // We need to create the function via SQL in the Supabase dashboard
    console.log(`
    To create the orphaned trades counting function, run this SQL in Supabase SQL Editor:
    
    CREATE OR REPLACE FUNCTION count_orphaned_trades()
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_user_id UUID;
      v_count INTEGER;
    BEGIN
      -- Get the current user ID
      v_user_id := auth.uid();
      
      IF v_user_id IS NULL THEN
        RETURN 0;
      END IF;
      
      -- Count orphaned trades
      SELECT COUNT(*)
      INTO v_count
      FROM trades t
      LEFT JOIN trading_accounts ta ON t.account_id = ta.id
      WHERE t.user_id = v_user_id AND ta.id IS NULL AND t.account_id IS NOT NULL;
      
      RETURN v_count;
    END;
    $$;
    
    GRANT EXECUTE ON FUNCTION count_orphaned_trades() TO authenticated;
    `);
    
    return false;
  } catch (err) {
    console.error('Error checking/creating orphaned trades function:', err);
    return false;
  }
}

/**
 * One-click fix for TopstepX trades
 */
async function fixTopstepXTrades() {
  console.log('🛠️ Starting TopstepX Trades Fix...');
  
  // Step 1: Create helper function
  await createOrphanedTradesFunction();
  
  // Step 2: Fix NULL account_id trades
  const fixResult = await fixTradesAccountId();
  
  if (!fixResult.success) {
    console.error('Failed to fix trades:', fixResult.error);
    alert('There was an error fixing your trades. Please check the console for details.');
    return;
  }
  
  // Step 3: Verify trades are now visible
  const verifyResult = await verifyTradesVisible();
  
  console.log('Fix process complete!');
  
  if (verifyResult.success) {
    console.log('✅ SUCCESS: Your trades should now be visible in the interface');
    alert(`SUCCESS: Your ${verifyResult.total_trades} trades should now appear in your trades, analytics, and performance pages!`);
  } else {
    console.log('⚠️ WARNING: Some trades may still not be visible');
    alert('Some trades may still not be visible. Please check the console for details.');
  }
  
  console.log('Refresh the page to see your trades!');
}

// Make functions available in the global scope
window.fixTradesTools = {
  fixTradesAccountId,
  verifyTradesVisible,
  fixTopstepXTrades
};

// Display instructions
console.log(`
-------------------------------------------------------
TOPSTEPX TRADES FIX TOOLS
-------------------------------------------------------

To fix your TopstepX trades so they appear in trades, analytics, and performance pages, run:

await window.fixTradesTools.fixTopstepXTrades()

Or run each step individually:

1. Fix NULL account_id trades:
   await window.fixTradesTools.fixTradesAccountId()

2. Verify trades are visible:
   await window.fixTradesTools.verifyTradesVisible()

After running the fix, refresh the page to see your trades!
-------------------------------------------------------
`);

// Automatically run the fix if the script is loaded directly in the console
if (typeof autoRunFix !== 'undefined' && autoRunFix) {
  fixTopstepXTrades();
} 