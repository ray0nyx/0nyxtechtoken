import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createClient } from './supabase/client';

export interface WalletBalance {
  address: string;
  blockchain: 'solana' | 'bitcoin';
  label?: string;
  balances: {
    [symbol: string]: {
      amount: number;
      usdValue: number;
    };
  };
  totalUsdValue: number;
}

export interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
  image?: string;
  name?: string;
}

/**
 * Fetch real wallet balances from Solana RPC (matching Solscan data)
 */
export async function fetchSolanaWalletBalance(address: string): Promise<WalletBalance> {
  const rpcEndpoints = [
    import.meta.env.VITE_SOLANA_RPC_URL,
    import.meta.env.VITE_ALCHEMY_RPC_URL,
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com'
  ].filter(Boolean);

  let connection: Connection | null = null;
  let balance = 0;

  // Try each RPC endpoint
  for (const endpoint of rpcEndpoints) {
    try {
      connection = new Connection(endpoint as string, 'confirmed');
      const publicKey = new PublicKey(address);
      balance = await connection.getBalance(publicKey);
      break; // Success, exit loop
    } catch (error) {
      console.warn(`Failed to fetch balance from ${endpoint}:`, error);
      continue;
    }
  }

  if (!connection) {
    throw new Error('All Solana RPC endpoints failed');
  }

  const solBalance = balance / LAMPORTS_PER_SOL;

  // Fetch SOL price from CoinGecko
  const solPrice = await fetchTokenPrice('solana');
  const solUsdValue = solBalance * solPrice.price;

  const balances: Record<string, { amount: number; usdValue: number }> = {
    SOL: {
      amount: solBalance,
      usdValue: solUsdValue,
    },
  };

  let totalUsdValue = solUsdValue;

  // Fetch token accounts (SPL tokens) to match Solscan data
  try {
    const publicKey = new PublicKey(address);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    // Common token mint addresses (matching Solscan)
    const tokenMints: Record<string, { symbol: string; coinId: string }> = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', coinId: 'usd-coin' },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', coinId: 'tether' },
      'So11111111111111111111111111111111111111112': { symbol: 'SOL', coinId: 'solana' },
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', coinId: 'marinade-staked-sol' },
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH', coinId: 'ethereum' },
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj6': { symbol: 'ORCA', coinId: 'orca' },
    };

    // Fetch prices for all tokens we find
    const tokenSymbols = new Set<string>();
    for (const account of tokenAccounts.value) {
      const mint = account.account.data.parsed.info.mint;
      const tokenInfo = tokenMints[mint];
      if (tokenInfo) {
        tokenSymbols.add(tokenInfo.coinId);
      }
    }

    // Fetch prices for all tokens
    const coinIds = Array.from(tokenSymbols);
    const prices = coinIds.length > 0 ? await fetchTokenPrices(coinIds) : {};

    // Process token accounts
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      const mint = parsedInfo.mint;
      const tokenAmount = parsedInfo.tokenAmount;
      const uiAmount = tokenAmount.uiAmount || 0;

      // Skip zero balances
      if (uiAmount === 0) continue;

      const tokenInfo = tokenMints[mint];
      if (tokenInfo) {
        const priceData = prices[tokenInfo.symbol] || { price: 0, change24h: 0 };
        const usdValue = uiAmount * priceData.price;

        balances[tokenInfo.symbol] = {
          amount: uiAmount,
          usdValue,
        };
        totalUsdValue += usdValue;
      } else {
        // Unknown token - try to get image from Jupiter in background
        fetchJupiterTokenImage(mint).then(image => {
          if (image) {
            // Try to identify symbol from Jupiter token list
            getJupiterTokenList().then(tokenList => {
              if (tokenList && tokenList[mint]) {
                const tokenInfo = tokenList[mint];
                const symbol = tokenInfo.symbol || 'UNKNOWN';
                // Add to balances if we can identify it
                if (symbol !== 'UNKNOWN') {
                  balances[symbol] = {
                    amount: uiAmount,
                    usdValue: 0, // Price unknown
                  };
                }
              }
            }).catch(() => { });
          }
        }).catch(() => { });
      }
    }
  } catch (error) {
    console.warn('Error fetching token accounts (continuing with SOL only):', error);
    // Continue with SOL balance only if token fetch fails
  }

  return {
    address,
    blockchain: 'solana',
    balances,
    totalUsdValue,
  };
}

/**
 * Fetch Bitcoin wallet balance from blockchain APIs
 */
export async function fetchBitcoinWalletBalance(address: string): Promise<WalletBalance> {
  // Try multiple Bitcoin APIs
  const apis = [
    `https://blockstream.info/api/address/${address}`,
    `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`,
  ];

  let balance = 0;

  for (const apiUrl of apis) {
    try {
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();

        // Blockstream API format
        if (data.chain_stats) {
          balance = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 1e8;
        }
        // BlockCypher API format
        else if (data.balance !== undefined) {
          balance = data.balance / 1e8;
        }

        if (balance > 0) break;
      }
    } catch (error) {
      console.warn(`Failed to fetch Bitcoin balance from ${apiUrl}:`, error);
      continue;
    }
  }

  // Fetch BTC price from CoinGecko
  const btcPrice = await fetchTokenPrice('bitcoin');
  const btcUsdValue = balance * btcPrice.price;

  return {
    address,
    blockchain: 'bitcoin',
    balances: {
      BTC: {
        amount: balance,
        usdValue: btcUsdValue,
      },
    },
    totalUsdValue: btcUsdValue,
  };
}

/**
 * Fetch token price and metadata from CoinGecko
 */
export async function fetchTokenPrice(coinId: string): Promise<TokenPrice> {
  try {
    // Fetch both price and coin data (which includes image)
    const [priceResponse, coinResponse] = await Promise.all([
      fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'default',
        }
      ),
      fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'default',
        }
      ).catch(() => null) // Don't fail if coin data fetch fails
    ]);

    if (!priceResponse.ok) {
      throw new Error(`CoinGecko API returned ${priceResponse.status}`);
    }

    const priceData = await priceResponse.json();
    const coinPriceData = priceData[coinId];

    let image: string | undefined;
    let name: string | undefined;

    if (coinResponse && coinResponse.ok) {
      try {
        const coinData = await coinResponse.json();
        image = coinData.image?.small || coinData.image?.thumb || coinData.image?.large;
        name = coinData.name;
      } catch (e) {
        // Ignore coin data parsing errors
      }
    }

    return {
      symbol: coinId === 'solana' ? 'SOL' : coinId === 'bitcoin' ? 'BTC' : coinId.toUpperCase(),
      price: coinPriceData?.usd || 0,
      change24h: coinPriceData?.usd_24h_change || 0,
      image,
      name,
    };
  } catch (error) {
    console.error('Error fetching token price:', error);
    // Return fallback price
    return {
      symbol: coinId === 'solana' ? 'SOL' : coinId === 'bitcoin' ? 'BTC' : coinId.toUpperCase(),
      price: coinId === 'solana' ? 100 : coinId === 'bitcoin' ? 50000 : 0,
      change24h: 0,
    };
  }
}

/**
 * Fetch token image from Jupiter token list for Solana tokens
 */
let jupiterTokenListCache: Record<string, { logoURI?: string; symbol?: string; name?: string }> | null = null;

async function getJupiterTokenList(): Promise<Record<string, { logoURI?: string; symbol?: string; name?: string }> | null> {
  if (jupiterTokenListCache) {
    return jupiterTokenListCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(
      'https://token.jup.ag/strict',
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const tokens = await response.json();
      const tokenMap: Record<string, { logoURI?: string; symbol?: string; name?: string }> = {};

      tokens.forEach((token: any) => {
        if (token.address) {
          tokenMap[token.address] = {
            logoURI: token.logoURI,
            symbol: token.symbol,
            name: token.name,
          };
        }
      });

      jupiterTokenListCache = tokenMap;
      return tokenMap;
    }
  } catch (error) {
    console.warn('Failed to fetch Jupiter token list:', error);
  }

  return null;
}

/**
 * Fetch token image from Jupiter API for Solana tokens
 */
async function fetchJupiterTokenImage(mintAddress: string): Promise<string | null> {
  try {
    const tokenList = await getJupiterTokenList();
    if (tokenList && tokenList[mintAddress]) {
      return tokenList[mintAddress].logoURI || null;
    }
  } catch (error) {
    // Ignore errors - Jupiter API is optional
  }
  return null;
}

/**
 * Fetch prices and images for multiple tokens from CoinGecko (optimized for speed)
 * Returns prices immediately, images load in background
 */
export async function fetchTokenPrices(coinIds: string[]): Promise<Record<string, TokenPrice>> {
  if (coinIds.length === 0) return {};

  try {
    const ids = coinIds.join(',');

    // Fetch prices with timeout (fast, don't wait too long)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const priceResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'default',
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!priceResponse.ok) {
      throw new Error(`CoinGecko API returned ${priceResponse.status}`);
    }

    const priceData = await priceResponse.json();
    const prices: Record<string, TokenPrice> = {};

    // Build prices object immediately (don't wait for images)
    coinIds.forEach(coinId => {
      const coinPriceData = priceData[coinId];
      const symbol = coinId === 'solana' ? 'SOL' :
        coinId === 'bitcoin' ? 'BTC' :
          coinId === 'ethereum' ? 'ETH' :
            coinId === 'cardano' ? 'ADA' :
              coinId === 'tether' ? 'USDT' :
                coinId === 'usd-coin' ? 'USDC' :
                  coinId.toUpperCase();

      prices[symbol] = {
        symbol,
        price: coinPriceData?.usd || 0,
        change24h: coinPriceData?.usd_24h_change || 0,
      };
    });

    // Fetch images in background (completely non-blocking)
    // Don't await this - let it run in background
    const limitedCoinIds = coinIds.slice(0, 10);
    Promise.allSettled(
      limitedCoinIds.map(async (coinId) => {
        try {
          const detailResponse = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              cache: 'default',
            }
          );
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return {
              coinId,
              image: detailData.image?.small || detailData.image?.thumb || detailData.image?.large,
              name: detailData.name,
            };
          }
        } catch (e) {
          // Ignore errors
        }
        return null;
      })
    ).then(imageResults => {
      // Update prices with images when they load (this won't block the return)
      imageResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const { coinId, image, name } = result.value;
          const symbol = coinId === 'solana' ? 'SOL' :
            coinId === 'bitcoin' ? 'BTC' :
              coinId === 'ethereum' ? 'ETH' :
                coinId === 'cardano' ? 'ADA' :
                  coinId === 'tether' ? 'USDT' :
                    coinId === 'usd-coin' ? 'USDC' :
                      coinId.toUpperCase();

          if (prices[symbol]) {
            prices[symbol].image = image;
            prices[symbol].name = name;
          }
        }
      });
    }).catch(() => { }); // Ignore errors

    return prices;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return {};
  }
}

/**
 * Generate sparkline data from price history (optimized with timeout)
 * Uses Python backend OHLCV data if available, otherwise generates from trades
 */
export async function generateSparklineData(
  symbol: string,
  timeframe: string = '1h',
  limit: number = 24
): Promise<number[]> {
  // Add timeout to prevent hanging
  const timeoutPromise = new Promise<number[]>((resolve) => {
    setTimeout(() => resolve([]), 2000); // 2s timeout
  });

  const fetchPromise = (async () => {
    try {
      // Try to fetch from Python backend (with timeout)
      const backendUrl = import.meta.env.VITE_MARKET_DATA_API || 'http://localhost:8001';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

      const response = await fetch(
        `${backendUrl}/api/ohlcv/${symbol}?timeframe=${timeframe}&limit=${limit}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          return data.data.map((candle: any) => parseFloat(candle.close) || 0);
        }
      }
    } catch (error) {
      // Ignore errors, try fallback
    }

    // Fallback: Quick database query (with timeout)
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Quick query with timeout
      const queryPromise = supabase
        .from('trades')
        .select('exit_price, created_at')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .not('exit_price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      const queryTimeout = new Promise((resolve) => {
        setTimeout(() => resolve({ data: null, error: null }), 1000); // 1s timeout
      });

      const { data: trades } = await Promise.race([queryPromise, queryTimeout]) as any;

      if (trades && trades.length > 0) {
        return trades
          .reverse()
          .map((trade: any) => parseFloat(trade.exit_price) || 0);
      }

      // If no trades, return empty (don't fetch price - too slow)
      return [];
    } catch (error) {
      return [];
    }
  })();

  // Race between fetch and timeout
  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Fetch all tracked wallets for a user
 */
export async function fetchUserTrackedWallets(userId: string): Promise<WalletBalance[]> {
  const supabase = createClient();

  const { data: wallets, error } = await supabase
    .from('wallet_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching tracked wallets:', error);
    return [];
  }

  if (!wallets || wallets.length === 0) {
    return [];
  }

  // Fetch balances for each wallet, keeping wallet info attached
  const walletBalances = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        let balance: WalletBalance | null = null;
        if (wallet.blockchain === 'solana') {
          balance = await fetchSolanaWalletBalance(wallet.wallet_address);
        } else if (wallet.blockchain === 'bitcoin') {
          balance = await fetchBitcoinWalletBalance(wallet.wallet_address);
        }

        if (balance) {
          // Attach the label from the database to the balance
          return {
            ...balance,
            label: wallet.label,
          };
        }

        // Even if balance fetch fails, return a wallet with zero balance so it shows in the list
        return {
          address: wallet.wallet_address,
          blockchain: wallet.blockchain as 'solana' | 'bitcoin',
          balances: {},
          totalUsdValue: 0,
          label: wallet.label,
        };
      } catch (error) {
        console.error(`Error fetching balance for ${wallet.wallet_address}:`, error);
        // Return wallet with zero balance on error so it still shows in the list
        return {
          address: wallet.wallet_address,
          blockchain: wallet.blockchain as 'solana' | 'bitcoin',
          balances: {},
          totalUsdValue: 0,
          label: wallet.label,
        };
      }
    })
  );

  return walletBalances;
}

