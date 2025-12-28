import Stripe from 'stripe';
import { createClient } from '../lib/supabase/client.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Commission calculation rules
const COMMISSION_RATES = {
  subscription: 0.15, // 15% for subscription payments
  one_time: 0.10,     // 10% for one-time payments
  trial: 0.00,        // 0% for trial periods
};

// Minimum commission amount
const MIN_COMMISSION = 1.00; // $1 minimum

// Initialize Supabase client
const supabase = createClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log('Received Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  console.log('Processing subscription created:', subscription.id);
  
  try {
    const customerId = subscription.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      console.log('No user found for customer:', customerId);
      return;
    }

    // Check if user was referred by an affiliate
    const referral = await getReferralByUserId(userId);
    
    if (referral) {
      // Calculate commission for subscription creation
      const amount = subscription.items.data[0]?.price?.unit_amount || 0;
      const commissionAmount = calculateCommission(amount, 'subscription');
      
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
        });
      }
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription updated:', subscription.id);
  
  try {
    const customerId = subscription.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      return;
    }

    const referral = await getReferralByUserId(userId);
    
    if (referral && subscription.status === 'active') {
      // Handle subscription reactivation
      const amount = subscription.items.data[0]?.price?.unit_amount || 0;
      const commissionAmount = calculateCommission(amount, 'subscription');
      
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
        });
      }
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  console.log('Processing subscription deleted:', subscription.id);
  
  try {
    const customerId = subscription.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      return;
    }

    // Mark any pending commissions as cancelled
    await supabase
      .from('commissions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id)
      .eq('status', 'pending');
      
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// Handle successful invoice payments
async function handlePaymentSucceeded(invoice) {
  console.log('Processing payment succeeded:', invoice.id);
  
  try {
    const customerId = invoice.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      return;
    }

    const referral = await getReferralByUserId(userId);
    
    if (referral) {
      const amount = invoice.amount_paid;
      const commissionAmount = calculateCommission(amount, 'subscription');
      
      if (commissionAmount > 0) {
        await createCommissionRecord({
          referral_id: referral.id,
          affiliate_id: referral.affiliate_id,
          user_id: userId,
          amount: commissionAmount,
          event_type: 'subscription_payment',
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: invoice.subscription,
          stripe_customer_id: customerId,
          description: `Commission for subscription payment - ${invoice.id}`
        });
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

// Handle failed payments
async function handlePaymentFailed(invoice) {
  console.log('Processing payment failed:', invoice.id);
  
  try {
    // Mark commissions as failed for this invoice
    await supabase
      .from('commissions')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_invoice_id', invoice.id)
      .eq('status', 'pending');
      
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

// Handle successful payment intents (one-time payments)
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Processing payment intent succeeded:', paymentIntent.id);
  
  try {
    const customerId = paymentIntent.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      return;
    }

    const referral = await getReferralByUserId(userId);
    
    if (referral) {
      const amount = paymentIntent.amount;
      const commissionAmount = calculateCommission(amount, 'one_time');
      
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
        });
      }
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

// Handle checkout completion
async function handleCheckoutCompleted(session) {
  console.log('Processing checkout completed:', session.id);
  
  try {
    const customerId = session.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    if (!userId) {
      return;
    }

    const referral = await getReferralByUserId(userId);
    
    if (referral) {
      const amount = session.amount_total || 0;
      const commissionAmount = calculateCommission(amount, 'one_time');
      
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
        });
      }
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

// Helper function to get user ID from Stripe customer ID
async function getUserIdFromCustomerId(customerId) {
  try {
    // First try to get from user_subscriptions table
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    if (subscription?.user_id) {
      return subscription.user_id;
    }
    
    // If not found, try to get from auth.users table
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.user_metadata?.stripe_customer_id === customerId);
    
    return user?.id || null;
  } catch (error) {
    console.error('Error getting user ID from customer ID:', error);
    return null;
  }
}

// Helper function to get referral by user ID
async function getReferralByUserId(userId) {
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
      .single();
    
    return referral;
  } catch (error) {
    console.error('Error getting referral by user ID:', error);
    return null;
  }
}

// Helper function to calculate commission
function calculateCommission(amount, type) {
  const rate = COMMISSION_RATES[type];
  const commission = (amount / 100) * rate; // Stripe amounts are in cents
  
  return Math.max(commission, MIN_COMMISSION);
}

// Helper function to create commission record
async function createCommissionRecord(data) {
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
      .single();
    
    if (error) {
      console.error('Error creating commission record:', error);
      throw error;
    }
    
    console.log('Commission record created:', commission);
    return commission;
  } catch (error) {
    console.error('Error in createCommissionRecord:', error);
    throw error;
  }
}
