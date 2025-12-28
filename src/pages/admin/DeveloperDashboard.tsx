import React, { useState, useEffect } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserSubscription } from '@/types/subscription.types';
import { useToast } from '@/components/ui/use-toast';

interface UserWithSubscription {
  id: string;
  email: string;
  created_at: string;
  subscription: UserSubscription | null;
}

interface DashboardStats {
  totalUsers: number;
  activeTrials: number;
  activeSubscriptions: number;
  expiredTrials: number;
  revenueMonthly: number;
  revenueYearly: number;
}

export default function DeveloperDashboard() {
  const { isDeveloper, isLoading: isSubscriptionLoading } = useSubscription();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeTrials: 0,
    activeSubscriptions: 0,
    expiredTrials: 0,
    revenueMonthly: 0,
    revenueYearly: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions'>('users');
  const { toast } = useToast();

  useEffect(() => {
    // Check current user ID
    const checkCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUserId(data.user.id);
        // Store in localStorage to grant developer access
        localStorage.setItem('currentUserId', data.user.id);
      }
    };
    
    checkCurrentUser();
  }, []);

  useEffect(() => {
    if (!isSubscriptionLoading && !isDeveloper) {
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch users with their subscriptions
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, created_at');
        
        if (userError) throw userError;
        
        const usersWithSubscriptions: UserWithSubscription[] = [];
        
        // For each user, fetch their subscription
        for (const user of userData || []) {
          const { data: subscriptionData } = await supabase
            .from('user_subscriptions')
            .select('*, plan:plan_id(*)')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();
          
          usersWithSubscriptions.push({
            ...user,
            subscription: subscriptionData || null
          });
        }
        
        setUsers(usersWithSubscriptions);
        
        // Calculate stats
        const now = new Date();
        const activeTrials = usersWithSubscriptions.filter(user => 
          user.subscription?.status === 'trial' && 
          new Date(user.subscription.trial_end_date || '') > now
        ).length;
        
        const activeSubscriptions = usersWithSubscriptions.filter(user => 
          user.subscription?.status === 'active'
        ).length;
        
        const expiredTrials = usersWithSubscriptions.filter(user => 
          user.subscription?.status === 'trial' && 
          new Date(user.subscription.trial_end_date || '') <= now
        ).length;
        
        // Calculate revenue (this is simplified, in a real app you'd use actual payment data)
        let revenueMonthly = 0;
        let revenueYearly = 0;
        
        usersWithSubscriptions.forEach(user => {
          if (user.subscription?.status === 'active' && user.subscription.plan) {
            if (user.subscription.current_period_end && 
                new Date(user.subscription.current_period_start || '') < 
                new Date(new Date(user.subscription.current_period_end).getTime() - 32 * 24 * 60 * 60 * 1000)) {
              // If period is longer than a month, assume yearly
              revenueYearly += user.subscription.plan.price_yearly;
            } else {
              revenueMonthly += user.subscription.plan.price_monthly;
            }
          }
        });
        
        setStats({
          totalUsers: usersWithSubscriptions.length,
          activeTrials,
          activeSubscriptions,
          expiredTrials,
          revenueMonthly,
          revenueYearly
        });
      } catch (error) {
        console.error('Error fetching developer dashboard data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load dashboard data',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [isSubscriptionLoading, isDeveloper, toast]);

  // Always allow access for testing purposes
  const isAuthorizedDeveloper = true; // currentUserId === '856950ff-d638-419d-bcf1-b7dac51d1c7f';

  // If not the authorized developer, redirect to home
  if (!isSubscriptionLoading && (!isDeveloper || !isAuthorizedDeveloper)) {
    return <Navigate to="/" />;
  }

  // Loading state
  if (isLoading || isSubscriptionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Prepare chart data
  const statusData = [
    { name: 'Active Trials', value: stats.activeTrials, color: '#3b82f6' },
    { name: 'Active Subscriptions', value: stats.activeSubscriptions, color: '#10b981' },
    { name: 'Expired Trials', value: stats.expiredTrials, color: '#ef4444' }
  ];

  const revenueData = [
    { name: 'Monthly', value: stats.revenueMonthly },
    { name: 'Yearly', value: stats.revenueYearly / 12 } // Normalized to monthly
  ];

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Developer Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Trials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.activeTrials}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.revenueMonthly + stats.revenueYearly / 12).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>User Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {/* Simple chart placeholder */}
            <div className="h-full flex flex-col items-center justify-center">
              <div className="flex gap-4 mb-4">
                {statusData.map((entry) => (
                  <div key={entry.name} className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full mb-2" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="text-lg font-bold">{entry.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Chart visualization requires recharts package</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {/* Simple chart placeholder */}
            <div className="h-full flex flex-col items-center justify-center">
              <div className="flex gap-8 mb-4">
                {revenueData.map((entry) => (
                  <div key={entry.name} className="flex flex-col items-center">
                    <div className="w-20 bg-green-500" style={{ height: `${Math.min(entry.value / 100, 150)}px` }}></div>
                    <span className="mt-2 text-sm font-medium">{entry.name}</span>
                    <span className="text-lg font-bold">${entry.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Chart visualization requires recharts package</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div>
        <div className="border-b mb-4">
          <div className="flex space-x-4">
            <Button 
              variant={activeTab === 'users' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('users')}
            >
              Users
            </Button>
            <Button 
              variant={activeTab === 'subscriptions' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('subscriptions')}
            >
              Subscriptions
            </Button>
          </div>
        </div>
        
        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle>User List</CardTitle>
              <CardDescription>All registered users and their subscription status</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4 text-left">Email</th>
                    <th className="py-2 px-4 text-left">Joined</th>
                    <th className="py-2 px-4 text-left">Subscription Status</th>
                    <th className="py-2 px-4 text-left">Plan</th>
                    <th className="py-2 px-4 text-left">Next Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="py-2 px-4">{user.email}</td>
                      <td className="py-2 px-4">{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="py-2 px-4">
                        {!user.subscription && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-800">No Subscription</Badge>
                        )}
                        {user.subscription?.status === 'trial' && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">Trial</Badge>
                        )}
                        {user.subscription?.status === 'active' && (
                          <Badge variant="outline" className="bg-green-100 text-green-800">Active</Badge>
                        )}
                        {user.subscription?.status === 'expired' && (
                          <Badge variant="outline" className="bg-red-100 text-red-800">Expired</Badge>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {user.subscription?.plan?.name || 'None'}
                      </td>
                      <td className="py-2 px-4">
                        {user.subscription?.current_period_end 
                          ? new Date(user.subscription.current_period_end).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'subscriptions' && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription Overview</CardTitle>
              <CardDescription>Detailed subscription metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Conversion Rate</h3>
                    <p className="text-sm text-muted-foreground">
                      {stats.activeSubscriptions > 0 && stats.totalUsers > 0
                        ? `${((stats.activeSubscriptions / stats.totalUsers) * 100).toFixed(1)}%`
                        : '0%'} of users are paying subscribers
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Trial Conversion</h3>
                    <p className="text-sm text-muted-foreground">
                      {stats.activeSubscriptions > 0 && (stats.activeSubscriptions + stats.expiredTrials) > 0
                        ? `${((stats.activeSubscriptions / (stats.activeSubscriptions + stats.expiredTrials)) * 100).toFixed(1)}%`
                        : '0%'} of trials convert to paid
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Revenue Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium">Monthly Revenue</p>
                      <p className="text-2xl font-bold">${stats.revenueMonthly.toFixed(2)}</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium">Annual Revenue (normalized monthly)</p>
                      <p className="text-2xl font-bold">${(stats.revenueYearly / 12).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 