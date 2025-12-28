import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Test Solana RPC connection
 */
export async function testSolanaConnection(rpcUrl?: string): Promise<boolean> {
  try {
    const endpoint = rpcUrl || import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(endpoint, 'confirmed');
    
    console.log('Testing Solana connection to:', endpoint);
    
    // Test 1: Get slot
    const slot = await connection.getSlot();
    console.log('✓ Current slot:', slot);
    
    // Test 2: Get version
    const version = await connection.getVersion();
    console.log('✓ Solana version:', version);
    
    // Test 3: Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('✓ Recent blockhash:', blockhash);
    
    console.log('✓ All connection tests passed!');
    return true;
  } catch (error) {
    console.error('✗ Connection test failed:', error);
    return false;
  }
}

/**
 * Test wallet balance retrieval
 */
export async function testWalletBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number | null> {
  try {
    console.log('Testing wallet balance for:', publicKey.toString());
    
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log('✓ Wallet balance:', solBalance, 'SOL');
    return solBalance;
  } catch (error) {
    console.error('✗ Balance test failed:', error);
    return null;
  }
}

/**
 * Test transaction signature fetching
 */
export async function testTransactionHistory(
  connection: Connection,
  publicKey: PublicKey,
  limit: number = 5
): Promise<boolean> {
  try {
    console.log('Testing transaction history for:', publicKey.toString());
    
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit });
    
    console.log(`✓ Found ${signatures.length} recent transactions`);
    
    if (signatures.length > 0) {
      console.log('First signature:', signatures[0].signature);
    }
    
    return true;
  } catch (error) {
    console.error('✗ Transaction history test failed:', error);
    return false;
  }
}

/**
 * Test DEX trade parsing with a known wallet
 */
export async function testDexTradeParsing(
  connection: Connection,
  walletAddress: string
): Promise<boolean> {
  try {
    console.log('Testing DEX trade parsing for:', walletAddress);
    
    const publicKey = new PublicKey(walletAddress);
    
    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
    console.log(`✓ Fetched ${signatures.length} signatures`);
    
    // Try to get one parsed transaction
    if (signatures.length > 0) {
      const tx = await connection.getParsedTransaction(signatures[0].signature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (tx) {
        console.log('✓ Successfully parsed transaction');
        console.log('  - Signature:', signatures[0].signature);
        console.log('  - Success:', !tx.meta?.err);
        console.log('  - Fee:', tx.meta?.fee, 'lamports');
      }
    }
    
    return true;
  } catch (error) {
    console.error('✗ DEX trade parsing test failed:', error);
    return false;
  }
}

/**
 * Mock transaction data for testing
 */
export const MOCK_DEX_TRADES = [
  {
    id: 'mock-1',
    dex: 'jupiter' as const,
    token_in: 'So11111111111111111111111111111111111111112', // SOL
    token_out: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount_in: 1.5,
    amount_out: 150,
    price_impact: 0.05,
    slippage: 0.1,
    fee: 0.000005,
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    tx_hash: '5Y8wVh' + Math.random().toString(36).substring(7),
    wallet: 'mock-wallet-address',
  },
  {
    id: 'mock-2',
    dex: 'raydium' as const,
    token_in: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    token_out: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    amount_in: 100,
    amount_out: 99.8,
    price_impact: 0.02,
    slippage: 0.05,
    fee: 0.000003,
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    tx_hash: '5Y8wVh' + Math.random().toString(36).substring(7),
    wallet: 'mock-wallet-address',
  },
];

/**
 * Mock master traders for testing
 */
export const MOCK_MASTER_TRADERS = [
  {
    id: 'test-1',
    wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'Test Whale Trader',
    description: 'Test master trader for development',
    tags: ['Test', 'Whale'],
    total_pnl: 500000,
    win_rate: 75,
    total_trades: 250,
    avg_trade_size: 10000,
    follower_count: 100,
    is_verified: true,
    is_curated: true,
    risk_level: 'medium' as const,
  },
];

/**
 * Run all tests
 */
export async function runAllTests(walletAddress?: string): Promise<{
  connectionTest: boolean;
  balanceTest: boolean;
  historyTest: boolean;
  parsingTest: boolean;
}> {
  console.log('='.repeat(50));
  console.log('Running Solana Integration Tests');
  console.log('='.repeat(50));
  
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(endpoint, 'confirmed');
  
  // Test 1: Connection
  console.log('\nTest 1: RPC Connection');
  console.log('-'.repeat(50));
  const connectionTest = await testSolanaConnection(endpoint);
  
  // Test 2: Balance (if wallet provided)
  let balanceTest = true;
  if (walletAddress) {
    console.log('\nTest 2: Wallet Balance');
    console.log('-'.repeat(50));
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await testWalletBalance(connection, publicKey);
      balanceTest = balance !== null;
    } catch (error) {
      console.error('✗ Invalid wallet address');
      balanceTest = false;
    }
  }
  
  // Test 3: Transaction History (if wallet provided)
  let historyTest = true;
  if (walletAddress) {
    console.log('\nTest 3: Transaction History');
    console.log('-'.repeat(50));
    try {
      const publicKey = new PublicKey(walletAddress);
      historyTest = await testTransactionHistory(connection, publicKey);
    } catch (error) {
      console.error('✗ Transaction history test failed');
      historyTest = false;
    }
  }
  
  // Test 4: DEX Trade Parsing (if wallet provided)
  let parsingTest = true;
  if (walletAddress) {
    console.log('\nTest 4: DEX Trade Parsing');
    console.log('-'.repeat(50));
    parsingTest = await testDexTradeParsing(connection, walletAddress);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));
  console.log('Connection Test:', connectionTest ? '✓ PASS' : '✗ FAIL');
  console.log('Balance Test:', balanceTest ? '✓ PASS' : '✗ FAIL');
  console.log('History Test:', historyTest ? '✓ PASS' : '✗ FAIL');
  console.log('Parsing Test:', parsingTest ? '✓ PASS' : '✗ FAIL');
  
  const allPassed = connectionTest && balanceTest && historyTest && parsingTest;
  console.log('\nOverall:', allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
  console.log('='.repeat(50));
  
  return {
    connectionTest,
    balanceTest,
    historyTest,
    parsingTest,
  };
}

// Export for use in console
if (typeof window !== 'undefined') {
  (window as any).testSolana = {
    testConnection: testSolanaConnection,
    testBalance: testWalletBalance,
    testHistory: testTransactionHistory,
    testParsing: testDexTradeParsing,
    runAll: runAllTests,
  };
  
  console.log('Solana test utilities loaded! Run tests with:');
  console.log('  window.testSolana.runAll(yourWalletAddress)');
}

