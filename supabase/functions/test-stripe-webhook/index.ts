import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await req.json()
    const { event_type, customer_id, amount, subscription_id, invoice_id } = body

    console.log('Test webhook received:', { event_type, customer_id, amount, subscription_id, invoice_id })

    // Get user ID from customer ID
    const userId = await getUserIdFromCustomerId(customer_id, supabase)
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No user found for customer ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get referral for this user
    const referral = await getReferralByUserId(userId, supabase)
    
    if (!referral) {
      return new Response(JSON.stringify({ error: 'No referral found for user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate commission
    const commissionAmount = calculateCommission(amount, event_type === 'subscription' ? 'subscription' : 'one_time')
    
    if (commissionAmount > 0) {
      // Create commission record
      const { data: commission, error } = await supabase
        .from('commissions')
        .insert([{
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: event_type,
          stripe_subscription_id: subscription_id,
          stripe_invoice_id: invoice_id,
          stripe_customer_id: customer_id,
          description: `Test commission for ${event_type} - $${amount}`,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating test commission:', error)
        return new Response(JSON.stringify({ error: 'Failed to create commission' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Test commission created successfully',
        commission,
        referral,
        calculatedAmount: commissionAmount
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'No commission created (amount too low)',
      calculatedAmount: commissionAmount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in test webhook:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// Helper function to get user ID from customer ID
async function getUserIdFromCustomerId(customerId: string, supabase: any): Promise<string | null> {
  try {
    // First try to get from user_subscriptions table
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single()
    
    if (subscription?.user_id) {
      return subscription.user_id
    }
    
    // If not found, try to get from auth.users table
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find((u: any) => u.user_metadata?.stripe_customer_id === customerId)
    
    return user?.id || null
  } catch (error) {
    console.error('Error getting user ID from customer ID:', error)
    return null
  }
}

// Helper function to get referral by user ID
async function getReferralByUserId(userId: string, supabase: any) {
  try {
    const { data: referral } = await supabase
      .from('referrals')
      .select(`
        id,
        affiliate_id,
        user_id,
        status
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()
    
    return referral
  } catch (error) {
    console.error('Error getting referral by user ID:', error)
    return null
  }
}

// Helper function to calculate commission
function calculateCommission(amount: number, type: 'subscription' | 'one_time' | 'trial'): number {
  const rates = {
    subscription: 0.15, // 15% for subscription payments
    one_time: 0.10,     // 10% for one-time payments
    trial: 0.00,        // 0% for trial periods
  }
  
  const rate = rates[type]
  const commission = amount * rate
  
  return Math.max(commission, 1.00) // $1 minimum
}
