import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'https://esm.sh/stripe@14.21.0/index.js'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

// Commission calculation rules
const COMMISSION_RATES = {
  subscription: 0.15, // 15% for subscription payments
  one_time: 0.10,     // 10% for one-time payments
  trial: 0.00,        // 0% for trial periods
}

// Minimum commission amount
const MIN_COMMISSION = 1.00 // $1 minimum

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature') as string
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  console.log('Received Stripe webhook event:', event.type)

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, supabase)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabase)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase)
        break
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, supabase)
        break
      
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// Handle subscription creation
async function handleSubscriptionCreated(subscription: Stripe.Subscription, supabase: any) {
  console.log('Processing subscription created:', subscription.id)
  
  try {
    const customerId = subscription.customer as string
    const userId = await getUserIdFromCustomerId(customerId, supabase)
    
    if (!userId) {
      console.log('No user found for customer:', customerId)
      return
    }

    // Check if subscription is in trial period
    const isInTrial = subscription.status === 'trialing' || 
                     (subscription.trial_end && subscription.trial_end * 1000 > Date.now())

    // Update or create subscription record
    const subscriptionData: any = {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: isInTrial ? 'trialing' : 'active',
      updated_at: new Date().toISOString()
    }

    if (isInTrial && subscription.trial_start && subscription.trial_end) {
      subscriptionData.trial_start_date = new Date(subscription.trial_start * 1000).toISOString()
      subscriptionData.trial_end_date = new Date(subscription.trial_end * 1000).toISOString()
    }

    if (subscription.current_period_start && subscription.current_period_end) {
      subscriptionData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString()
      subscriptionData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString()
    }

    // Upsert subscription record
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        ...subscriptionData
      }, {
        onConflict: 'user_id'
      })

    // Check if user was referred by an affiliate
    const referral = await getReferralByUserId(userId, supabase)
    
    if (referral && !isInTrial) {
      // Only calculate commission for non-trial subscriptions
      const amount = subscription.items.data[0]?.price?.unit_amount || 0
      const commissionAmount = calculateCommission(amount, 'subscription')
      
      if (commissionAmount > 0) {
        await createCommissionRecord({
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: 'subscription_created',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          description: `Commission for subscription creation - ${subscription.id}`
        }, supabase)
      }
    }
  } catch (error) {
    console.error('Error handling subscription created:', error)
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
  console.log('Processing subscription updated:', subscription.id)
  
  try {
    const customerId = subscription.customer as string
    const userId = await getUserIdFromCustomerId(customerId, supabase)
    
    if (!userId) {
      return
    }

    // Check if subscription was canceled during trial period
    const isInTrial = subscription.status === 'trialing' || 
                     (subscription.trial_end && subscription.trial_end * 1000 > Date.now())
    const isCanceled = subscription.cancel_at_period_end || subscription.status === 'canceled'

    if (isCanceled && isInTrial) {
      // Subscription canceled during trial - revoke access immediately
      console.log('Subscription canceled during trial - revoking access immediately')
      
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          trial_end_date: new Date().toISOString(), // Set trial end to now to revoke access
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('stripe_subscription_id', subscription.id)
    } else if (subscription.status === 'active') {
      // Update subscription to active status
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          stripe_subscription_id: subscription.id,
          current_period_start: subscription.current_period_start 
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
    }

    const referral = await getReferralByUserId(userId, supabase)
    
    if (referral && subscription.status === 'active') {
      // Handle subscription reactivation
      const amount = subscription.items.data[0]?.price?.unit_amount || 0
      const commissionAmount = calculateCommission(amount, 'subscription')
      
      if (commissionAmount > 0) {
        await createCommissionRecord({
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: 'subscription_reactivated',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          description: `Commission for subscription reactivation - ${subscription.id}`
        }, supabase)
      }
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error)
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
  console.log('Processing subscription deleted:', subscription.id)
  
  try {
    const customerId = subscription.customer as string
    const userId = await getUserIdFromCustomerId(customerId, supabase)
    
    if (!userId) {
      return
    }

    // Check if subscription was in trial period when deleted
    const wasInTrial = subscription.status === 'trialing' || 
                      (subscription.trial_end && subscription.trial_end * 1000 > Date.now())

    if (wasInTrial) {
      // Subscription deleted during trial - revoke access immediately
      console.log('Subscription deleted during trial - revoking access immediately')
      
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          trial_end_date: new Date().toISOString(), // Set trial end to now to revoke access
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('stripe_subscription_id', subscription.id)
    } else {
      // Regular cancellation - mark as canceled
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('stripe_subscription_id', subscription.id)
    }

    // Mark any pending commissions as cancelled
    await supabase
      .from('commissions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id)
      .eq('status', 'pending')
      
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
  }
}

// Handle successful invoice payments
async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
  console.log('Processing payment succeeded:', invoice.id)
  
  try {
    const customerId = invoice.customer as string
    const userId = await getUserIdFromCustomerId(customerId, supabase)
    
    if (!userId) {
      return
    }

    const referral = await getReferralByUserId(userId, supabase)
    
    if (referral) {
      const amount = invoice.amount_paid
      const commissionAmount = calculateCommission(amount, 'subscription')
      
      if (commissionAmount > 0) {
        await createCommissionRecord({
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: 'subscription_payment',
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: invoice.subscription as string,
          stripe_customer_id: customerId,
          description: `Commission for subscription payment - ${invoice.id}`
        }, supabase)
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
  }
}

// Handle failed payments
async function handlePaymentFailed(invoice: Stripe.Invoice, supabase: any) {
  console.log('Processing payment failed:', invoice.id)
  
  try {
    // Mark commissions as failed for this invoice
    await supabase
      .from('commissions')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_invoice_id', invoice.id)
      .eq('status', 'pending')
      
  } catch (error) {
    console.error('Error handling payment failed:', error)
  }
}

// Handle successful payment intents (one-time payments)
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  console.log('Processing payment intent succeeded:', paymentIntent.id)
  
  try {
    const customerId = paymentIntent.customer as string
    const userId = await getUserIdFromCustomerId(customerId, supabase)
    
    if (!userId) {
      return
    }

    const referral = await getReferralByUserId(userId, supabase)
    
    if (referral) {
      const amount = paymentIntent.amount
      const commissionAmount = calculateCommission(amount, 'one_time')
      
      if (commissionAmount > 0) {
        await createCommissionRecord({
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: 'one_time_payment',
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: customerId,
          description: `Commission for one-time payment - ${paymentIntent.id}`
        }, supabase)
      }
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error)
  }
}

// Handle checkout completion
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: any) {
  console.log('Processing checkout completed:', session.id)
  
  try {
    const customerId = session.customer as string
    const userId = await getUserIdFromCustomerId(customerId, supabase)
    
    if (!userId) {
      return
    }

    // If this is a subscription checkout, the subscription will be handled by subscription.created event
    // But we can ensure the subscription record exists with trial information
    if (session.mode === 'subscription' && session.subscription) {
      // Fetch the subscription to get trial details
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      })
      
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const isInTrial = subscription.status === 'trialing' || 
                         (subscription.trial_end && subscription.trial_end * 1000 > Date.now())

        if (isInTrial && subscription.trial_start && subscription.trial_end) {
          await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              status: 'trialing',
              trial_start_date: new Date(subscription.trial_start * 1000).toISOString(),
              trial_end_date: new Date(subscription.trial_end * 1000).toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
        }
      } catch (subError) {
        console.error('Error fetching subscription details:', subError)
      }
    }

    const referral = await getReferralByUserId(userId, supabase)
    
    if (referral && session.mode === 'payment') {
      // Only calculate commission for one-time payments, not subscriptions (subscriptions handled elsewhere)
      const amount = session.amount_total || 0
      const commissionAmount = calculateCommission(amount, 'one_time')
      
      if (commissionAmount > 0) {
        await createCommissionRecord({
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: 'checkout_completed',
          stripe_checkout_session_id: session.id,
          stripe_customer_id: customerId,
          description: `Commission for checkout completion - ${session.id}`
        }, supabase)
      }
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error)
  }
}

// Helper function to get user ID from Stripe customer ID
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
      .in('status', ['active', 'pending']) // Include both active and pending referrals
      .single()
    
    return referral
  } catch (error) {
    console.error('Error getting referral by user ID:', error)
    return null
  }
}

// Helper function to calculate commission
function calculateCommission(amount: number, type: 'subscription' | 'one_time' | 'trial'): number {
  const rate = COMMISSION_RATES[type]
  const commission = (amount / 100) * rate // Stripe amounts are in cents
  
  // Only apply minimum commission for non-trial payments
  if (type === 'trial') {
    return commission // $0 for trials
  }
  
  return Math.max(commission, MIN_COMMISSION)
}

// Helper function to create commission record
async function createCommissionRecord(data: {
  referral_id: string
  affiliate_id: string
  user_id: string
  amount: number
  event_type: string
  stripe_subscription_id?: string
  stripe_invoice_id?: string
  stripe_payment_intent_id?: string
  stripe_checkout_session_id?: string
  stripe_customer_id?: string
  description: string
}, supabase: any) {
  try {
    const { data: commission, error } = await supabase
      .from('commissions')
      .insert([{
        referral_id: data.referral_id,
        affiliate_id: data.affiliate_id,
        user_id: data.user_id,
        amount: data.amount,
        event_type: data.event_type,
        stripe_subscription_id: data.stripe_subscription_id,
        stripe_invoice_id: data.stripe_invoice_id,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        stripe_checkout_session_id: data.stripe_checkout_session_id,
        stripe_customer_id: data.stripe_customer_id,
        description: data.description,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating commission record:', error)
      throw error
    }
    
    console.log('Commission record created:', commission)
    return commission
  } catch (error) {
    console.error('Error in createCommissionRecord:', error)
    throw error
  }
}
