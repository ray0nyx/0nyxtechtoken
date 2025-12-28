import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log('Hello from Process Tradovate CSV Batch!')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the request body
    const { p_user_id, p_data, p_account_id } = await req.json()

    // Parse the JSON data
    const trades = JSON.parse(p_data)

    // Validate input
    if (!p_user_id || !trades || !Array.isArray(trades)) {
      throw new Error('Invalid input parameters')
    }

    // Process each trade
    const results = []
    for (const trade of trades) {
      try {
        // Insert into trades_staging
        const { data: stagingData, error: stagingError } = await supabaseClient
          .from('trades_staging')
          .insert([{
            ...trade,
            user_id: p_user_id,
            account_id: p_account_id || null
          }])
          .select()

        if (stagingError) {
          console.error('Error inserting into trades_staging:', stagingError)
          results.push({ success: false, error: stagingError.message })
          continue
        }

        // Get the inserted trade ID
        const tradeId = stagingData[0].id

        results.push({ id: tradeId, success: true })
      } catch (error) {
        console.error('Error processing trade:', error)
        results.push({ success: false, error: error.message })
      }
    }

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}) 