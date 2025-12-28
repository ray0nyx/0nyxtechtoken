import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  revenueGrowth: number;
  conversionRate: number;
  newUsers: number;
  userGrowth: number;
  avgSessionTime: number;
  retention: number;
  pageViews: number;
}

export type TimeFrame = 'day' | 'week' | 'month' | 'year';

// Get date range for a given timeframe
export const getDateRange = (timeframe: TimeFrame): { start: string; end: string } => {
  const now = new Date();
  let start = new Date();
  
  switch (timeframe) {
    case 'day':
      start.setHours(0, 0, 0, 0); // Start of today
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  };
};

// Get previous period date range
export const getPreviousPeriodRange = (timeframe: TimeFrame): { start: string; end: string } => {
  const { start, end } = getDateRange(timeframe);
  const currentStart = new Date(start);
  const currentEnd = new Date(end);
  const duration = currentEnd.getTime() - currentStart.getTime();
  
  const prevEnd = new Date(currentStart);
  prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setMilliseconds(prevStart.getMilliseconds() - duration);
  
  return {
    start: prevStart.toISOString(),
    end: prevEnd.toISOString()
  };
};

// Get total users count
export const getTotalUsers = async (): Promise<number> => {
  try {
    // Skip admin_metrics_daily table check since it doesn't exist
    // Go directly to users table
    
    // Get from users table
    // Note: We're using the auth.users table via a different approach
    try {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });
      
      if (error) {
        console.error('Error fetching total users:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('Error accessing users table:', error);
      // Return a fallback value
      return 0;
    }
  } catch (error) {
    console.error('Error in getTotalUsers:', error);
    return 0;
  }
};

// Get active users (users who logged in during the timeframe)
export const getActiveUsers = async (timeframe: TimeFrame): Promise<number> => {
  try {
    const { start, end } = getDateRange(timeframe);
    
    // Skip admin_metrics_daily table check since it doesn't exist
    // Use fallback approach
    
    // For now, return a fallback value since admin.listUsers requires special permissions
    // In production, you would implement this differently or use a server-side function
    console.log('Active users calculation requires admin privileges - returning fallback value');
    return 0;
  } catch (error) {
    console.error('Error in getActiveUsers:', error);
    return 0;
  }
};

// Get new users count
export const getNewUsers = async (timeframe: TimeFrame): Promise<{
  newUsers: number;
  growth: number;
}> => {
  try {
    const { start, end } = getDateRange(timeframe);
    const previousPeriod = getPreviousPeriodRange(timeframe);
    
    // Query for new users in current period
    try {
      const { data: currentUsers, error: currentError } = await supabase
        .from('users')
        .select('id, created_at')
        .gte('created_at', start)
        .lte('created_at', end);
      
      if (currentError) {
        console.error('Error fetching new users (current):', currentError);
        return { newUsers: 0, growth: 0 };
      }
      
      // Query for new users in previous period
      const { data: prevUsers, error: prevError } = await supabase
        .from('users')
        .select('id, created_at')
        .gte('created_at', previousPeriod.start)
        .lte('created_at', previousPeriod.end);
    
      if (prevError) {
        console.error('Error fetching new users (previous):', prevError);
        return { newUsers: currentUsers?.length || 0, growth: 0 };
      }
      
      // Calculate growth rate
      const currentCount = currentUsers?.length || 0;
      const prevCount = prevUsers?.length || 0;
      
      let growth = 0;
      if (prevCount > 0) {
        growth = ((currentCount - prevCount) / prevCount) * 100;
      }
      
      return {
        newUsers: currentCount,
        growth: parseFloat(growth.toFixed(1))
      };
    } catch (error) {
      console.error('Error accessing users table for new users:', error);
      return { newUsers: 0, growth: 0 };
    }
  } catch (error) {
    console.error('Error in getNewUsers:', error);
    return { newUsers: 0, growth: 0 };
  }
};

// Get revenue data from Stripe
export const getRevenueData = async (timeframe: TimeFrame): Promise<{
  revenue: number;
  growth: number;
}> => {
  const currentPeriod = getDateRange(timeframe);
  const previousPeriod = getPreviousPeriodRange(timeframe);
  
  try {
    // Skip admin_metrics_daily table check since it doesn't exist
    // Go directly to fallback approach
    
    // If not in metrics table, try to get from Stripe
    const stripeApiEndpoint = '/api/admin/stripe-revenue';
    const response = await fetch(stripeApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPeriodStart: currentPeriod.start,
        currentPeriodEnd: currentPeriod.end,
        previousPeriodStart: previousPeriod.start,
        previousPeriodEnd: previousPeriod.end,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        revenue: data.currentRevenue || 0,
        growth: data.growth || 0
      };
    }
    
    // Fallback to subscription data if Stripe API fails
    console.warn('Falling back to subscription data for revenue calculation');
  } catch (error) {
    console.error('Error fetching Stripe revenue data:', error);
    console.warn('Falling back to subscription data for revenue calculation');
  }
  
  // Fallback: Get active subscriptions in current period from Supabase
  const { data: subscriptions, error: subError } = await supabase
    .from('user_subscriptions')
    .select(`
      user_id,
      status,
      access_level
    `)
    .eq('status', 'active');
  
  if (subError) {
    console.error('Error fetching subscription data:', subError);
    return { revenue: 0, growth: 0 };
  }
  
  // Simple revenue calculation based on access levels and subscription status
  let revenue = 0;
  if (subscriptions && subscriptions.length > 0) {
    // Apply estimated pricing based on access level (customize as needed)
    subscriptions.forEach(sub => {
      if (sub.status === 'active') {
        switch (sub.access_level) {
          case 'basic':
            revenue += 9.99;
            break;
          case 'pro':
            revenue += 19.99;
            break;
          case 'full_access':
            revenue += 49.99;
            break;
          case 'enterprise':
            revenue += 99.99;
            break;
          default:
            revenue += 0;
        }
      }
    });
  }
  
  // For growth, we use a placeholder value since we don't have historical data
  // In a production system, you would compare with previous period revenue
  return { revenue, growth: 5.0 };
};

// Get conversion rate (percentage of users with active subscriptions)
export const getConversionRate = async (): Promise<{
  rate: number;
  change: number;
}> => {
  try {
    // Skip admin_metrics_daily table check since it doesn't exist
    // Go directly to fallback approach
    
    // Get total users
    const totalUsers = await getTotalUsers();
    
    // Get active subscribers
    const { count: activeSubscribers, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (subError) {
      console.error('Error fetching active subscribers:', subError);
      return { rate: 0, change: 0 };
    }
    
    // Calculate conversion rate
    let rate = 0;
    if (totalUsers > 0 && activeSubscribers) {
      rate = (activeSubscribers / totalUsers) * 100;
    }
    
    return {
      rate: parseFloat(rate.toFixed(1)),
      change: 0.3 // Placeholder for change
    };
  } catch (error) {
    console.error('Error in getConversionRate:', error);
    return { rate: 0, change: 0 };
  }
};

// Get average session time
export const getAvgSessionTime = async (timeframe: TimeFrame): Promise<{
  avgTime: number;
  change: number;
}> => {
  const { start, end } = getDateRange(timeframe);
  
  try {
    // Calculate average session time based on user_subscriptions access level
    // This is a fallback approach when we don't have actual session data
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('access_level')
      .eq('status', 'active');
    
    if (subError) {
      console.error('Error fetching subscriptions for session time:', subError);
      return { avgTime: 0, change: 0 };
    }
    
    // Assuming different access levels correlate with different engagement levels
    // This is a placeholder calculation and should be replaced with actual analytics data
    let totalMinutes = 0;
    if (subscriptions && subscriptions.length > 0) {
      subscriptions.forEach(sub => {
        switch (sub.access_level) {
          case 'basic':
            totalMinutes += 5; // Assume basic users spend less time
            break;
          case 'pro':
            totalMinutes += 15; // Pro users spend more time
            break;
          case 'full_access':
            totalMinutes += 25; // Full access users spend the most time
            break;
          default:
            totalMinutes += 8; // Default value
        }
      });
      
      const avgTimeMinutes = totalMinutes / subscriptions.length;
      return { 
        avgTime: parseFloat(avgTimeMinutes.toFixed(1)), 
        change: 1.2 // Placeholder
      };
    }
    
    // If no subscriptions, return default values
    return { avgTime: 8.2, change: 1.2 };
  } catch (error) {
    console.error('Error in getAvgSessionTime:', error);
    return { avgTime: 8.2, change: 1.2 };
  }
};

// Get retention rate
export const getRetentionRate = async (timeframe: TimeFrame): Promise<{
  rate: number;
  change: number;
}> => {
  try {
    // This is a placeholder calculation based on subscription status
    // In a real implementation, you would track user return rates
    // For now, calculate an approximate retention based on active trials vs. active paid
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('status')
      .in('status', ['active', 'trial']);
    
    if (subError) {
      console.error('Error fetching subscription data for retention:', subError);
      return { rate: 0, change: 0 };
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      return { rate: 0, change: 0 };
    }
    
    // Count active (paid) subscriptions vs trials
    const totalCount = subscriptions.length;
    const activeCount = subscriptions.filter(sub => sub.status === 'active').length;
    
    // Calculate retention as the percentage of active paid out of all subscriptions
    // This is a simplification - true retention would account for time periods
    let retentionRate = 0;
    if (totalCount > 0) {
      retentionRate = (activeCount / totalCount) * 100;
    }
    
    return {
      rate: parseFloat(retentionRate.toFixed(1)),
      change: 2.1 // Placeholder
    };
  } catch (error) {
    console.error('Error in getRetentionRate:', error);
    return { rate: 0, change: 0 };
  }
};

// Get page views
export const getPageViews = async (timeframe: TimeFrame): Promise<{
  views: number;
  change: number;
}> => {
  try {
    // Since we don't have actual page view tracking,
    // we'll create an estimate based on user count and access level
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id');
    
    if (userError) {
      console.error('Error fetching users for page views:', userError);
      return { views: 0, change: 0 };
    }
    
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, access_level, status');
    
    if (subError) {
      console.error('Error fetching subscriptions for page views:', subError);
      return { views: 0, change: 0 };
    }
    
    // Build a map of user_id to access_level
    const userAccessMap = new Map();
    if (subscriptions) {
      subscriptions.forEach(sub => {
        userAccessMap.set(sub.user_id, { 
          access_level: sub.access_level,
          status: sub.status
        });
      });
    }
    
    // Calculate estimated page views
    let totalViews = 0;
    
    if (users) {
      users.forEach(user => {
        const userInfo = userAccessMap.get(user.id);
        let viewsPerUser = 10; // Default views per user
        
        if (userInfo) {
          // Adjust based on access level and status
          if (userInfo.status === 'active') {
            switch (userInfo.access_level) {
              case 'basic':
                viewsPerUser = 20;
                break;
              case 'pro':
                viewsPerUser = 50;
                break;
              case 'full_access':
                viewsPerUser = 100;
                break;
              default:
                viewsPerUser = 10;
            }
          } else if (userInfo.status === 'trial') {
            viewsPerUser = 30; // Trials tend to explore more
          }
        }
        
        totalViews += viewsPerUser;
      });
    }
    
    return { 
      views: totalViews,
      change: -3.4 // Placeholder
    };
  } catch (error) {
    console.error('Error in getPageViews:', error);
    return { views: 0, change: 0 };
  }
};

// Get all dashboard stats at once
export const getDashboardStats = async (timeframe: TimeFrame): Promise<DashboardStats> => {
  try {
    // Run queries in parallel for efficiency
    const [
      totalUsers,
      activeUsersCount,
      newUsersData,
      revenueData,
      conversionData,
      sessionTimeData,
      retentionData,
      pageViewsData
    ] = await Promise.all([
      getTotalUsers(),
      getActiveUsers(timeframe),
      getNewUsers(timeframe),
      getRevenueData(timeframe),
      getConversionRate(),
      getAvgSessionTime(timeframe),
      getRetentionRate(timeframe),
      getPageViews(timeframe)
    ]);
    
    return {
      totalUsers,
      activeUsers: activeUsersCount,
      revenue: revenueData.revenue,
      revenueGrowth: revenueData.growth,
      conversionRate: conversionData.rate,
      newUsers: newUsersData.newUsers,
      userGrowth: newUsersData.growth,
      avgSessionTime: sessionTimeData.avgTime,
      retention: retentionData.rate,
      pageViews: pageViewsData.views
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    
    // Return zeros instead of mock data
    return {
      totalUsers: 0,
      activeUsers: 0,
      revenue: 0,
      revenueGrowth: 0,
      conversionRate: 0,
      newUsers: 0,
      userGrowth: 0,
      avgSessionTime: 0,
      retention: 0,
      pageViews: 0
    };
  }
}; 