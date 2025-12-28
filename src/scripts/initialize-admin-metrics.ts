import { supabase } from '@/lib/supabase';

// This script will initialize the admin_metrics_daily table with some initial data
// Run this script with ts-node or use during deployment to seed initial metrics

const seedInitialMetrics = async () => {
  console.log('Starting to seed admin metrics...');

  try {
    // Check if we already have metrics for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingMetrics, error: checkError } = await supabase
      .from('admin_metrics_daily')
      .select('id')
      .eq('metric_date', today)
      .limit(1);

    if (checkError) {
      throw new Error(`Error checking existing metrics: ${checkError.message}`);
    }

    if (existingMetrics && existingMetrics.length > 0) {
      console.log('Metrics for today already exist, skipping seeding.');
      return;
    }

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (usersError) {
      console.error('Error fetching total users:', usersError);
    }

    // Get active users (users who were active in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: activeUsers, error: activeError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('last_sign_in_at', thirtyDaysAgo.toISOString());

    if (activeError) {
      console.error('Error fetching active users:', activeError);
    }

    // Get subscription counts and revenue
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        subscription_plans!inner(price_monthly, price_yearly)
      `)
      .eq('status', 'active');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
    }

    // Calculate metrics
    const metrics = [
      {
        metric_date: today,
        metric_name: 'total_users',
        metric_value: totalUsers || 0,
        metric_data: { source: 'users' }
      },
      {
        metric_date: today,
        metric_name: 'active_users',
        metric_value: activeUsers || 0,
        metric_data: { time_period: '30_days', source: 'users' }
      },
      {
        metric_date: today,
        metric_name: 'new_users_7d',
        metric_value: Math.floor(Math.random() * 100) + 20, // Placeholder value
        metric_data: { time_period: '7_days', source: 'users' }
      },
      {
        metric_date: today,
        metric_name: 'new_users_30d',
        metric_value: Math.floor(Math.random() * 300) + 50, // Placeholder value
        metric_data: { time_period: '30_days', source: 'users' }
      }
    ];

    // Add revenue metrics if we have subscriptions
    if (subscriptions && subscriptions.length > 0) {
      const revenue = subscriptions.reduce((total, sub) => {
        const price = sub.subscription_plans?.price_monthly || 0;
        return total + Number(price);
      }, 0);

      metrics.push({
        metric_date: today,
        metric_name: 'revenue',
        metric_value: revenue,
        metric_data: { currency: 'USD', source: 'subscriptions' }
      });

      // Add revenue growth metric
      metrics.push({
        metric_date: today,
        metric_name: 'revenue_growth',
        metric_value: 5.2, // Placeholder value, would normally be calculated
        metric_data: { currency: 'USD', source: 'calculated' }
      });

      // Calculate conversion rate
      if (totalUsers && totalUsers > 0) {
        const conversionRate = (subscriptions.length / totalUsers) * 100;
        metrics.push({
          metric_date: today,
          metric_name: 'conversion_rate',
          metric_value: parseFloat(conversionRate.toFixed(2)),
          metric_data: { source: 'calculated' }
        });
      }
    }

    // Add some placeholder metrics for demonstration
    metrics.push(
      {
        metric_date: today,
        metric_name: 'avg_session_time',
        metric_value: 8.2, // 8.2 minutes
        metric_data: { unit: 'minutes', source: 'user_trade_metrics' }
      },
      {
        metric_date: today,
        metric_name: 'retention_rate',
        metric_value: 76, // 76%
        metric_data: { time_period: '30_days', source: 'calculated' }
      },
      {
        metric_date: today,
        metric_name: 'page_views',
        metric_value: 24598,
        metric_data: { source: 'user_trade_metrics' }
      }
    );

    // Insert all metrics in a single batch
    const { error: insertError } = await supabase
      .from('admin_metrics_daily')
      .insert(metrics);

    if (insertError) {
      throw new Error(`Error inserting metrics: ${insertError.message}`);
    }

    console.log(`Successfully inserted ${metrics.length} metrics for ${today}`);
  } catch (error) {
    console.error('Error seeding admin metrics:', error);
  }
};

// Execute the function if this script is run directly
if (require.main === module) {
  seedInitialMetrics()
    .then(() => {
      console.log('Admin metrics initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to initialize admin metrics:', error);
      process.exit(1);
    });
}

export default seedInitialMetrics; 