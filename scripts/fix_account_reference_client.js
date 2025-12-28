/**
 * CLIENT-SIDE DIAGNOSTIC AND FIX FOR TRADING ACCOUNTS ISSUE
 * 
 * This script helps diagnose and fix issues with trading_accounts
 * referenced by trades. It identifies when an invalid account ID is being
 * used and ensures a valid trading account exists before trades are uploaded.
 */

/**
 * Function to check if a trading account exists
 * @param {string} accountId - The account ID to check
 * @returns {Promise<boolean>} - True if the account exists, false otherwise
 */
async function checkTradingAccountExists(accountId) {
  try {
    const { data, error } = await window.supabase
      .from('trading_accounts')
      .select('id')
      .eq('id', accountId)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking account:', error);
      return false;
    }
    
    return data !== null;
  } catch (err) {
    console.error('Error in checkTradingAccountExists:', err);
    return false;
  }
}

/**
 * Function to list all trading accounts for the current user
 * @returns {Promise<Array>} - Array of trading accounts
 */
async function listUserTradingAccounts() {
  try {
    const { data, error } = await window.supabase
      .from('trading_accounts')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching trading accounts:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in listUserTradingAccounts:', err);
    return [];
  }
}

/**
 * Function to create a new trading account for the current user
 * @param {string} [name='Default Trading Account'] - The name for the new account
 * @param {string} [specificId=null] - Optional specific UUID to use
 * @returns {Promise<string|null>} - The ID of the created account or null
 */
async function createTradingAccount(name = 'Default Trading Account', specificId = null) {
  try {
    // Ensure user is logged in
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.error('User not logged in');
      return null;
    }
    
    const userId = session.user.id;
    const newAccount = {
      user_id: userId,
      name: name,
      created_at: new Date().toISOString()
    };
    
    // Add specific ID if provided
    if (specificId) {
      newAccount.id = specificId;
    }
    
    const { data, error } = await window.supabase
      .from('trading_accounts')
      .insert([newAccount])
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating trading account:', error);
      return null;
    }
    
    console.log('Created new trading account with ID:', data.id);
    return data.id;
  } catch (err) {
    console.error('Error in createTradingAccount:', err);
    return null;
  }
}

/**
 * Function to get or create a specific account ID
 * @param {string} specificId - The specific account ID to create
 * @returns {Promise<string|null>} - The ID of the account or null
 */
async function getOrCreateSpecificAccount(specificId) {
  try {
    // First check if account already exists
    const exists = await checkTradingAccountExists(specificId);
    if (exists) {
      console.log(`Account ${specificId} already exists`);
      return specificId;
    }
    
    // Create account with specific ID
    const accountId = await createTradingAccount('Fixed Specific Account', specificId);
    return accountId;
  } catch (err) {
    console.error('Error in getOrCreateSpecificAccount:', err);
    return null;
  }
}

/**
 * Function to fix specific problematic account ID
 * @param {string} problematicId - The problematic account ID to fix
 * @returns {Promise<boolean>} - True if the fix was successful
 */
async function fixProblematicAccountId(problematicId = '33f4ad8c-d025-45fc-aa3e-7f71a162d943') {
  console.log(`Attempting to fix problematic account ID: ${problematicId}`);
  
  try {
    // Try to create the account with the specific ID
    const accountId = await getOrCreateSpecificAccount(problematicId);
    
    if (!accountId) {
      console.error(`Failed to create account with ID: ${problematicId}`);
      return false;
    }
    
    console.log(`Successfully fixed account ID: ${problematicId}`);
    return true;
  } catch (err) {
    console.error('Error fixing problematic account ID:', err);
    return false;
  }
}

/**
 * Function to check and fix trades with account ID issues
 * @returns {Promise<{fixed: number, errors: number}>}
 */
async function diagnoseAndFixTrades() {
  console.log('Diagnosing and fixing trades with account issues...');
  
  try {
    // First, ensure a valid trading account exists
    const accounts = await listUserTradingAccounts();
    
    if (accounts.length === 0) {
      const newAccountId = await createTradingAccount();
      if (!newAccountId) {
        console.error('Failed to create trading account');
        return { fixed: 0, errors: 1 };
      }
    }
    
    // Try to fix the specific problematic account
    const fixResult = await fixProblematicAccountId();
    console.log('Fix attempt result:', fixResult);
    
    // Call the server-side fix function
    const { data, error } = await window.supabase.rpc('fix_orphaned_trades');
    
    if (error) {
      console.error('Error calling fix_orphaned_trades function:', error);
      return { fixed: 0, errors: 1 };
    }
    
    console.log('Server-side fix result:', data);
    return { fixed: data?.fixed_count || 0, errors: 0 };
  } catch (err) {
    console.error('Error in diagnoseAndFixTrades:', err);
    return { fixed: 0, errors: 1 };
  }
}

/**
 * One-click function to diagnose and fix account issues
 */
async function oneClickAccountFix() {
  console.log('Starting one-click account fix...');
  
  // Step 1: Check current user session
  const { data: { session } } = await window.supabase.auth.getSession();
  if (!session) {
    console.error('User not logged in');
    return false;
  }
  
  console.log('User authenticated:', session.user.id);
  
  // Step 2: List existing trading accounts
  const accounts = await listUserTradingAccounts();
  console.log(`Found ${accounts.length} trading accounts for user`);
  
  // Step 3: Fix the specific problematic account ID
  await fixProblematicAccountId('33f4ad8c-d025-45fc-aa3e-7f71a162d943');
  
  // Step 4: Run the server-side fix for orphaned trades
  const result = await diagnoseAndFixTrades();
  
  console.log('Fix result:', result);
  return result.errors === 0;
}

// Export functions for use in browser console
window.tradingAccountsTools = {
  checkTradingAccountExists,
  listUserTradingAccounts,
  createTradingAccount,
  fixProblematicAccountId,
  diagnoseAndFixTrades,
  oneClickAccountFix
};

// Instructions for users
console.log(`
-------------------------------------------------------
TRADING ACCOUNTS FIX TOOLS
-------------------------------------------------------

To fix trading account issues, run:

await window.tradingAccountsTools.oneClickAccountFix()

To create a specific account ID:

await window.tradingAccountsTools.fixProblematicAccountId('33f4ad8c-d025-45fc-aa3e-7f71a162d943')

To list your trading accounts:

await window.tradingAccountsTools.listUserTradingAccounts()
-------------------------------------------------------
`); 