import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface SolanaWalletRequest {
  walletAddress: string;
  useDevnet?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight - must return 200 OK
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let walletAddress: string;
    let useDevnet = false;
    
    try {
      const body = await req.json();
      walletAddress = body.walletAddress;
      useDevnet = body.useDevnet || false;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Wallet address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first
    const cacheKey = `${walletAddress}_${useDevnet ? 'devnet' : 'mainnet'}`;
    const { data: cachedData } = await supabase
      .from('wallet_analytics_cache')
      .select('data')
      .eq('wallet_address', walletAddress)
      .eq('blockchain', 'solana')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedData) {
      return new Response(
        JSON.stringify({ data: cachedData.data, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch wallet data from Solana RPC
    const rpcUrl = useDevnet 
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';

    // Get SOL balance
    const balanceResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [walletAddress],
      }),
    });
    const balanceData = await balanceResponse.json();
    const lamports = balanceData.result?.value || 0;
    const sol = lamports / 1e9;

    // Get token accounts
    const tokenResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' },
        ],
      }),
    });
    const tokenData = await tokenResponse.json();
    const tokens = (tokenData.result?.value || []).map((account: any) => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        amount: parsedInfo.tokenAmount.uiAmount || 0,
        decimals: parsedInfo.tokenAmount.decimals,
      };
    });

    // Get transaction signatures (recent)
    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'getSignaturesForAddress',
        params: [walletAddress, { limit: 10 }],
      }),
    });
    const txData = await txResponse.json();
    const transactions = (txData.result || []).map((sig: any) => ({
      signature: sig.signature,
      timestamp: sig.blockTime,
      err: sig.err,
    }));

    // Get SOL price (using CoinGecko)
    let solPrice = 100; // Fallback
    try {
      const priceResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const priceData = await priceResponse.json();
      solPrice = priceData.solana?.usd || 100;
    } catch (e) {
      console.error('Error fetching SOL price:', e);
    }

    const walletData = {
      address: walletAddress,
      balance: {
        sol,
        usdValue: sol * solPrice,
      },
      tokens,
      transactionCount: transactions.length,
      lastTransactionDate: transactions[0]?.timestamp
        ? new Date(transactions[0].timestamp * 1000).toISOString()
        : undefined,
      solPrice,
    };

    // Cache the result (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabase
      .from('wallet_analytics_cache')
      .upsert({
        wallet_address: walletAddress,
        blockchain: 'solana',
        data: walletData,
        expires_at: expiresAt,
      }, {
        onConflict: 'wallet_address,blockchain',
      });

    return new Response(
      JSON.stringify({ data: walletData, cached: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

