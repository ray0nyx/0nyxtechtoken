import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4?target=deno&no-check'

// Define CORS headers
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
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'User not authenticated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Get query parameters
    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Call the get_user_analytics function
    const { data, error } = await supabaseClient.rpc('get_user_analytics', {
      user_uuid: user.id
    })

    if (error) {
      console.error('Error fetching analytics:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Filter by date range if provided
    let filteredData = data
    if (startDate && endDate) {
      filteredData = data.filter((item: any) => {
        const itemDate = new Date(item.date)
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate)
      })
    }

    // Calculate overall statistics
    const totalTrades = filteredData.reduce((sum: number, item: any) => sum + Number(item.total_trades), 0)
    const winningTrades = filteredData.reduce((sum: number, item: any) => sum + Number(item.winning_trades), 0)
    const losingTrades = filteredData.reduce((sum: number, item: any) => sum + Number(item.losing_trades), 0)
    const totalPnl = filteredData.reduce((sum: number, item: any) => sum + Number(item.total_pnl), 0)
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const averagePnl = totalTrades > 0 ? totalPnl / totalTrades : 0
    
    // Find largest win and loss
    const largestWin = Math.max(...filteredData.map((item: any) => Number(item.largest_win) || 0))
    const largestLoss = Math.min(...filteredData.map((item: any) => Number(item.largest_loss) || 0))

    // Calculate profit factor
    const profitFactor = losingTrades > 0 ? 
      Math.abs(filteredData.reduce((sum: number, item: any) => 
        sum + (Number(item.winning_trades) > 0 ? Number(item.total_pnl) : 0), 0)) / 
      Math.abs(filteredData.reduce((sum: number, item: any) => 
        sum + (Number(item.losing_trades) > 0 ? Number(item.total_pnl) : 0), 0)) : 
      0

    // Return the analytics data
    return new Response(
      JSON.stringify({
        dailyStats: filteredData,
        overallStats: {
          totalTrades,
          winningTrades,
          losingTrades,
          winRate,
          totalPnl,
          averagePnl,
          largestWin,
          largestLoss,
          profitFactor
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in get-analytics function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}) 