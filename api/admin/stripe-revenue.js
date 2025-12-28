const Stripe = require('stripe');
const { createClient } = require('../lib/supabase/client');

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Initialize Supabase client
const supabase = createClient();

export default async function handler(req, res) {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify admin access
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // Check for session-based authentication
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Check if user is an admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (userError || userData?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
    } else {
      // If using token-based auth, verify the token
      // This is a simple token verification for demonstration
      // In production, use a proper JWT verification
      if (authHeader !== `Bearer ${process.env.ADMIN_API_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Get date ranges from request body
    const {
      currentPeriodStart,
      currentPeriodEnd,
      previousPeriodStart,
      previousPeriodEnd,
    } = req.body;

    // Validate required parameters
    if (!currentPeriodStart || !currentPeriodEnd) {
      return res.status(400).json({ error: 'Missing required date parameters' });
    }

    // Convert dates to Unix timestamps for Stripe (seconds, not milliseconds)
    const currentStart = Math.floor(new Date(currentPeriodStart).getTime() / 1000);
    const currentEnd = Math.floor(new Date(currentPeriodEnd).getTime() / 1000);
    const prevStart = previousPeriodStart ? Math.floor(new Date(previousPeriodStart).getTime() / 1000) : null;
    const prevEnd = previousPeriodEnd ? Math.floor(new Date(previousPeriodEnd).getTime() / 1000) : null;

    // Fetch payment intents for the current period
    const currentPeriodPayments = await stripe.paymentIntents.list({
      created: {
        gte: currentStart,
        lte: currentEnd,
      },
      limit: 100, // Adjust as needed
    });

    // Calculate total revenue for current period (only successful payments)
    const currentRevenue = currentPeriodPayments.data
      .filter(payment => payment.status === 'succeeded')
      .reduce((total, payment) => total + (payment.amount / 100), 0); // Convert from cents to dollars

    // Calculate growth if previous period data is provided
    let growth = 0;
    let previousRevenue = 0;

    if (prevStart && prevEnd) {
      // Fetch payment intents for the previous period
      const previousPeriodPayments = await stripe.paymentIntents.list({
        created: {
          gte: prevStart,
          lte: prevEnd,
        },
        limit: 100, // Adjust as needed
      });

      // Calculate total revenue for previous period (only successful payments)
      previousRevenue = previousPeriodPayments.data
        .filter(payment => payment.status === 'succeeded')
        .reduce((total, payment) => total + (payment.amount / 100), 0); // Convert from cents to dollars

      // Calculate growth rate
      if (previousRevenue > 0) {
        growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      }
    }

    // Return the revenue data
    return res.status(200).json({
      currentRevenue,
      previousRevenue,
      growth,
      currency: 'USD', // Assuming USD as the default currency
    });
  } catch (error) {
    console.error('Error fetching Stripe revenue data:', error);
    return res.status(500).json({
      error: error.message || 'An unknown error occurred',
    });
  }
}
