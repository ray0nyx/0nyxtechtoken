import { createClient } from '../lib/supabase/client.js';

// Initialize Supabase client
const supabase = createClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event_type, customer_id, amount, subscription_id, invoice_id } = req.body;

    console.log('Test webhook received:', { event_type, customer_id, amount, subscription_id, invoice_id });

    // Get user ID from customer ID
    const userId = await getUserIdFromCustomerId(customer_id);
    
    if (!userId) {
      return res.status(400).json({ error: 'No user found for customer ID' });
    }

    // Get referral for this user
    const referral = await getReferralByUserId(userId);
    
    if (!referral) {
      return res.status(400).json({ error: 'No referral found for user' });
    }

    // Calculate commission
    const commissionAmount = calculateCommission(amount, event_type === 'subscription' ? 'subscription' : 'one_time');
    
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
        .single();

      if (error) {
        console.error('Error creating test commission:', error);
        return res.status(500).json({ error: 'Failed to create commission' });
      }

      return res.status(200).json({
        success: true,
        message: 'Test commission created successfully',
        commission,
        referral,
        calculatedAmount: commissionAmount
      });
    }

    return res.status(200).json({
      success: true,
      message: 'No commission created (amount too low)',
      calculatedAmount: commissionAmount
    });

  } catch (error) {
    console.error('Error in test webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to get user ID from customer ID
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
  const rates = {
    subscription: 0.15, // 15% for subscription payments
    one_time: 0.10,     // 10% for one-time payments
    trial: 0.00,        // 0% for trial periods
  };
  
  const rate = rates[type];
  const commission = amount * rate;
  
  return Math.max(commission, 1.00); // $1 minimum
}
