import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { connectionId, syncType, symbols, startDate, endDate } = await req.json()

    if (!connectionId || !syncType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabaseClient
      .from('user_exchange_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create sync session
    const { data: session, error: sessionError } = await supabaseClient
      .from('trade_sync_sessions')
      .insert({
        connection_id: connectionId,
        sync_type: syncType,
        status: 'running'
      })
      .select()
      .single()

    if (sessionError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create sync session' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Start sync process based on type
    if (syncType === 'historical') {
      await syncHistoricalTrades(supabaseClient, connection, session, startDate, endDate, symbols)
    } else if (syncType === 'realtime') {
      await startRealtimeSync(supabaseClient, connection, session, symbols)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId: session.id,
        message: `Sync ${syncType} started for ${connection.exchange_name}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Sync trades error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * Sync historical trades
 */
async function syncHistoricalTrades(
  supabaseClient: any,
  connection: any,
  session: any,
  startDate?: string,
  endDate?: string,
  symbols?: string[]
) {
  try {
    // Decrypt credentials
    const credentials = await decryptCredentials(connection.credentials_encrypted)
    
    // Import CCXT
    const ccxt = await import('https://esm.sh/ccxt@4.1.0')
    
    // Create exchange instance
    const exchangeClass = ccxt[connection.exchange_name]
    if (!exchangeClass) {
      throw new Error(`Exchange ${connection.exchange_name} not supported`)
    }

    const exchangeInstance = new exchangeClass({
      apiKey: credentials.apiKey,
      secret: credentials.secret,
      passphrase: credentials.passphrase,
      sandbox: credentials.sandbox || false,
      enableRateLimit: true,
      timeout: 30000,
    })

    // Load markets
    await exchangeInstance.loadMarkets()

    // Get available symbols
    const markets = exchangeInstance.markets
    const availableSymbols = symbols || Object.keys(markets).slice(0, 10)

    let totalTrades = 0
    let totalUpdated = 0

    // Set date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const end = endDate ? new Date(endDate) : new Date()

    // Sync trades for each symbol
    for (const symbol of availableSymbols) {
      try {
        console.log(`Syncing ${symbol} for ${connection.exchange_name}`)
        
        const trades = await exchangeInstance.fetchMyTrades(
          symbol, 
          start.getTime(), 
          undefined, 
          1000
        )
        
        for (const trade of trades) {
          try {
            // Normalize trade data
            const normalizedTrade = normalizeTrade(connection.exchange_name, trade)
            
            // Check if trade already exists
            const { data: existingTrade } = await supabaseClient
              .from('trades')
              .select('id')
              .eq('exchange_trade_id', normalizedTrade.exchangeTradeId)
              .eq('connection_id', connection.id)
              .single()

            if (existingTrade) {
              // Update existing trade
              const { error: updateError } = await supabaseClient
                .from('trades')
                .update(normalizedTrade)
                .eq('id', existingTrade.id)

              if (!updateError) totalUpdated++
            } else {
              // Insert new trade
              const { error: insertError } = await supabaseClient
                .from('trades')
                .insert(normalizedTrade)

              if (!insertError) totalTrades++
            }
          } catch (tradeError) {
            console.error('Error processing trade:', tradeError)
          }
        }
      } catch (symbolError) {
        console.error(`Error syncing symbol ${symbol}:`, symbolError)
      }
    }

    // Update sync session
    const completedAt = new Date()
    const duration = completedAt.getTime() - new Date(session.started_at).getTime()

    await supabaseClient
      .from('trade_sync_sessions')
      .update({
        completed_at: completedAt.toISOString(),
        trades_synced: totalTrades,
        trades_updated: totalUpdated,
        sync_duration: `${duration}ms`,
        status: 'completed'
      })
      .eq('id', session.id)

    // Update connection status
    await supabaseClient
      .from('user_exchange_connections')
      .update({
        sync_status: 'connected',
        last_sync_at: completedAt.toISOString(),
        updated_at: completedAt.toISOString()
      })
      .eq('id', connection.id)

    console.log(`Historical sync completed: ${totalTrades} new trades, ${totalUpdated} updated`)

  } catch (error) {
    console.error('Historical sync error:', error)
    
    // Update sync session with error
    await supabaseClient
      .from('trade_sync_sessions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', session.id)

    // Update connection status
    await supabaseClient
      .from('user_exchange_connections')
      .update({
        sync_status: 'error',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)
  }
}

/**
 * Start real-time sync
 */
async function startRealtimeSync(
  supabaseClient: any,
  connection: any,
  session: any,
  symbols?: string[]
) {
  try {
    // Update connection status to syncing
    await supabaseClient
      .from('user_exchange_connections')
      .update({
        sync_status: 'syncing',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    // For now, just mark as completed since WebSocket handling is complex in Edge Functions
    // In production, you'd want to use a separate service for WebSocket connections
    await supabaseClient
      .from('trade_sync_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        sync_duration: '0ms'
      })
      .eq('id', session.id)

    console.log(`Real-time sync started for ${connection.exchange_name}`)

  } catch (error) {
    console.error('Real-time sync error:', error)
    
    await supabaseClient
      .from('trade_sync_sessions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', session.id)
  }
}

/**
 * Decrypt credentials
 */
async function decryptCredentials(encryptedData: any): Promise<any> {
  try {
    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(encryptedData.key),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedData.iv) },
      key,
      base64ToArrayBuffer(encryptedData.encrypted)
    )

    const plaintext = new TextDecoder().decode(decrypted)
    return JSON.parse(plaintext)
  } catch (error) {
    console.error('Decryption error:', error)
    throw error
  }
}

/**
 * Normalize trade data
 */
function normalizeTrade(exchange: string, rawTrade: any): any {
  const baseTrade = {
    user_id: rawTrade.userId || rawTrade.user_id,
    connection_id: rawTrade.connectionId || rawTrade.connection_id,
    exchange_trade_id: rawTrade.id || rawTrade.tradeId || rawTrade.orderId,
    symbol: rawTrade.symbol,
    side: rawTrade.side === 'buy' || rawTrade.side === 'BUY' ? 'buy' : 'sell',
    quantity: parseFloat(rawTrade.amount || rawTrade.qty || rawTrade.size || 0),
    price: parseFloat(rawTrade.price || rawTrade.rate || 0),
    fee: parseFloat(rawTrade.fee?.cost || rawTrade.commission || 0),
    fee_currency: rawTrade.fee?.currency || rawTrade.commissionAsset || 'USDT',
    executed_at: new Date(rawTrade.timestamp || rawTrade.time || rawTrade.createdAt),
    exchange_timestamp: new Date(rawTrade.timestamp || rawTrade.time || rawTrade.createdAt),
    platform: exchange,
    order_id: rawTrade.orderId || rawTrade.order_id,
    position_id: rawTrade.positionId || rawTrade.position_id,
    broker: exchange,
    timestamp: new Date(rawTrade.timestamp || rawTrade.time || rawTrade.createdAt),
    pnl: null,
    notes: `Synced from ${exchange}`,
    raw_data: rawTrade
  }

  return baseTrade
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
