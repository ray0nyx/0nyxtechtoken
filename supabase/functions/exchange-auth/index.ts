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
    const { exchange, credentials, userId } = await req.json()

    if (!exchange || !credentials || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Attempting to connect to ${exchange} for user ${userId}`)

    // Validate exchange credentials
    const isValid = await validateExchangeCredentials(exchange, credentials)

    if (!isValid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid credentials for ' + exchange 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Encrypt credentials (server-side encryption)
    const encryptedCredentials = await encryptCredentials(credentials)

    // Store connection in database
    const { data, error } = await supabaseClient
      .from('user_exchange_connections')
      .insert({
        user_id: userId,
        exchange_name: exchange,
        connection_type: 'api_key',
        credentials_encrypted: encryptedCredentials,
        is_active: true,
        sync_status: 'connected',
        last_sync_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to store connection' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        connectionId: data.id,
        message: `Successfully connected to ${exchange}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Exchange auth error:', error)
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
 * Validate exchange credentials by testing API access
 */
async function validateExchangeCredentials(exchange: string, credentials: any): Promise<boolean> {
  try {
    // Import CCXT dynamically
    const ccxt = await import('https://esm.sh/ccxt@4.1.0')
    
    // Create exchange instance
    const exchangeClass = ccxt[exchange]
    if (!exchangeClass) {
      console.error(`Exchange ${exchange} not supported`)
      return false
    }

    const exchangeInstance = new exchangeClass({
      apiKey: credentials.apiKey,
      secret: credentials.secret,
      password: credentials.passphrase, // Some exchanges use 'password' instead of 'passphrase'
      uid: credentials.username, // Some exchanges use 'uid' instead of 'apiKey'
      sandbox: credentials.sandbox || false,
      enableRateLimit: true,
      timeout: 10000,
    })

    // Test connection by fetching markets
    await exchangeInstance.loadMarkets()
    
    return true
  } catch (error) {
    console.error(`Validation failed for ${exchange}:`, error)
    return false
  }
}

/**
 * Encrypt credentials using Web Crypto API
 */
async function encryptCredentials(credentials: any): Promise<any> {
  try {
    // Generate a random key for this encryption
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encrypt credentials
    const plaintext = JSON.stringify(credentials)
    const encodedPlaintext = new TextEncoder().encode(plaintext)
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedPlaintext
    )

    // Export key for storage
    const exportedKey = await crypto.subtle.exportKey('raw', key)

    return {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv),
      key: arrayBufferToBase64(exportedKey)
    }
  } catch (error) {
    console.error('Encryption error:', error)
    throw error
  }
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
