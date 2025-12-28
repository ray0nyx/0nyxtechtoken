import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { createClient } from '@/lib/supabase/client';
import { 
  Copy, 
  ExternalLink, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Calendar,
  Link as LinkIcon,
  Share2,
  Eye,
  MousePointer
} from 'lucide-react';
import { PayoutRequestForm } from '@/components/affiliate/PayoutRequestForm';
import { PayoutHistory } from '@/components/affiliate/PayoutHistory';
import { payoutService } from '@/services/payoutService';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  commission_rate: number;
  status: string;
  date_applied: string;
}

interface ReferralStats {
  total_clicks: number;
  total_signups: number;
  total_conversions: number;
  pending_commission: number;
  paid_commission: number;
  conversion_rate: number;
}

interface RecentReferral {
  id: string;
  email: string;
  status: string;
  commission_amount: number;
  created_at: string;
}

export const AffiliateDashboard: React.FC = () => {
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [stats, setStats] = useState<ReferralStats>({
    total_clicks: 0,
    total_signups: 0,
    total_conversions: 0,
    pending_commission: 0,
    paid_commission: 0,
    conversion_rate: 0
  });
  const [recentReferrals, setRecentReferrals] = useState<RecentReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState('');
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  const fetchAffiliateData = async () => {
    try {
      setLoading(true);
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setLoading(false);
        toast({
          title: "Timeout",
          description: "Loading took too long. Please try again.",
          variant: "destructive",
        });
      }, 10000); // 10 second timeout
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        clearTimeout(timeoutId);
        console.error('No authenticated user for affiliate dashboard');
        throw new Error('Not authenticated');
      }

      console.log('Fetching affiliate data for user:', user.email);

      // Get affiliate data
      const { data: affiliate, error: affiliateError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('email', user.email)
        .eq('status', 'active')
        .single();

      console.log('Affiliate query result:', { affiliate, affiliateError });

      if (affiliateError) {
        console.error('Error fetching affiliate data:', affiliateError);
        toast({
          title: "Error",
          description: "Failed to load affiliate data. Please check if you're an approved affiliate.",
          variant: "destructive",
        });
        return;
      }

      if (!affiliate) {
        console.error('No affiliate data found for user:', user.email);
        toast({
          title: "Access Denied",
          description: "You don't have affiliate access. Please contact support if you believe this is an error.",
          variant: "destructive",
        });
        return;
      }

      console.log('Affiliate data loaded successfully:', affiliate);
      setAffiliateData(affiliate);

      // Get referral stats
      const { data: referrals, error: referralsError } = await supabase
        .from('referrals')
        .select('*')
        .eq('affiliate_id', affiliate.id);

      // Get commission stats (this is where the actual commission amounts are stored)
      const { data: commissions, error: commissionsError } = await supabase
        .from('commissions')
        .select(`
          id,
          amount,
          status,
          event_type,
          description,
          created_at,
          users (
            id,
            email,
            created_at
          )
        `)
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false });

      if (!referralsError && referrals) {
        const totalSignups = referrals.length;
        
        // Calculate conversions based on users who have commissions (meaning they've made payments)
        const usersWithCommissions = new Set(commissions?.map(c => c.user_id) || []);
        const totalConversions = usersWithCommissions.size;

        // Calculate commissions from the commissions table (more accurate)
        const pendingCommission = commissions?.filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
        const paidCommission = commissions?.filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

        setStats({
          total_clicks: 0, // This would need to be tracked separately
          total_signups: totalSignups,
          total_conversions: totalConversions,
          pending_commission: pendingCommission,
          paid_commission: paidCommission,
          conversion_rate: totalSignups > 0 ? (totalConversions / totalSignups) * 100 : 0
        });

        // Get recent referrals from commissions (more accurate)
        const recentRefs = commissions?.slice(0, 10).map(c => ({
          id: c.id,
          email: c.users?.email || 'Unknown',
          status: c.status || 'pending',
          commission_amount: c.amount || 0,
          created_at: c.created_at
        })) || [];

      setRecentReferrals(recentRefs);
    }
    
    clearTimeout(timeoutId);
  } catch (error) {
    console.error('Error fetching affiliate data:', error);
    toast({
      title: "Error",
      description: "Failed to load affiliate dashboard",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const getAffiliateLink = () => {
    if (!affiliateData) return '';
    return `${window.location.origin}/signup?ref=${affiliateData.referral_code}`;
  };

  const getPricingLink = () => {
    if (!affiliateData) return '';
    return `${window.location.origin}/pricing?ref=${affiliateData.referral_code}`;
  };

  if (loading) {
    return (
      <div className="w-full max-w-none py-6 md:py-8 space-y-6 md:space-y-8 px-2">
        <LoadingSpinner 
          message="Loading affiliate dashboard..." 
          subMessage="Please wait while we fetch your affiliate data"
        />
      </div>
    );
  }

  if (!affiliateData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Affiliate Access Required</h3>
          <p className="text-gray-600">You need to be an approved affiliate to access this dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-none py-6 md:py-8 space-y-6 md:space-y-8 px-2">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/20">
          <DollarSign className="h-8 w-8 text-green-400" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-purple-500">Affiliate Dashboard</h1>
          <p className="text-slate-400 mt-1">Track your referrals and earnings</p>
        </div>
      </div>

      {/* Commission Rules */}
      <Card className="border-slate-200 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-green-500/10 overflow-hidden bg-white dark:bg-transparent dark:backdrop-blur-sm">
        <CardHeader className="bg-green-50 dark:bg-green-500/10">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-500/20">
              <DollarSign className="w-4 h-4 text-green-500 dark:text-green-400" />
            </div>
            Commission Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-4">
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-slate-300 font-medium">
              We have one of the best commission structures in the space and want you to succeed with us!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-slate-800/30 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2">30% Commission</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">On all cash collected from all your referrals for a period of 12 months</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800/30 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Monthly Payments</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Consistent monthly payment schedule for reliable income</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800/30 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                <h3 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">$50 Minimum</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Minimum $50 payout threshold for easy withdrawals</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Bonus:</strong> As you tier up and grow with us you will also have the opportunity to earn a lifetime commission!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-blue-500/10 overflow-hidden bg-white dark:bg-transparent dark:backdrop-blur-sm">
          <CardHeader className="pb-2 bg-blue-50 dark:bg-blue-500/10">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-1 rounded-lg bg-blue-500/20">
                <Users className="w-3 h-3 text-blue-500 dark:text-blue-400" />
              </div>
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-3 py-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_signups}</div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">All time signups</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-green-500/10 overflow-hidden bg-white dark:bg-transparent dark:backdrop-blur-sm">
          <CardHeader className="pb-2 bg-green-50 dark:bg-green-500/10">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-1 rounded-lg bg-green-500/20">
                <TrendingUp className="w-3 h-3 text-green-500 dark:text-green-400" />
              </div>
              Conversions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-3 py-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total_conversions}</div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{stats.conversion_rate.toFixed(1)}% conversion rate</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-yellow-500/10 overflow-hidden bg-white dark:bg-transparent dark:backdrop-blur-sm">
          <CardHeader className="pb-2 bg-yellow-50 dark:bg-yellow-500/10">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-1 rounded-lg bg-yellow-500/20">
                <DollarSign className="w-3 h-3 text-yellow-500 dark:text-yellow-400" />
              </div>
              Pending Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-3 py-4">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${stats.pending_commission.toFixed(2)}</div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:shadow-purple-500/10 overflow-hidden bg-white dark:bg-transparent dark:backdrop-blur-sm">
          <CardHeader className="pb-2 bg-purple-50 dark:bg-purple-500/10">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-1 rounded-lg bg-purple-500/20">
                <DollarSign className="w-3 h-3 text-purple-500 dark:text-purple-400" />
              </div>
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-3 py-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">${(stats.pending_commission + stats.paid_commission).toFixed(2)}</div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">All time earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Affiliate Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center" style={{ color: '#9333ea' }}>
            <LinkIcon className="w-5 h-5 mr-2" />
            Your Affiliate Links
          </CardTitle>
          <CardDescription style={{ color: '#9333ea' }}>
            Share these links to earn {affiliateData.commission_rate}% commission on each sale
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#9333ea' }}>
              Affiliate Code
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 border rounded text-sm font-mono" style={{ color: '#9333ea', fontWeight: 'bold' }}>
                {affiliateData.referral_code}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(affiliateData.referral_code, 'Affiliate code')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#9333ea' }}>
              Signup Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={getAffiliateLink()}
                className="flex-1 px-3 py-2 bg-gray-100 border rounded text-sm"
                style={{ color: '#9333ea', fontWeight: 'bold' }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(getAffiliateLink(), 'Signup link')}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getAffiliateLink(), '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#9333ea' }}>
              Pricing Page Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={getPricingLink()}
                className="flex-1 px-3 py-2 bg-gray-100 border rounded text-sm"
                style={{ color: '#9333ea', fontWeight: 'bold' }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(getPricingLink(), 'Pricing link')}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getPricingLink(), '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
          <CardDescription>Your latest referral activity</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-4">
          {recentReferrals.length > 0 ? (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{referral.email}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={referral.status === 'paid' ? 'default' : 'secondary'}
                      className={referral.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {referral.status}
                    </Badge>
                    <span className="text-sm font-medium">
                      ${referral.commission_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Commission Activity Yet</h3>
              <p className="text-gray-600 mb-4">
                {stats.total_signups > 0 
                  ? `You have ${stats.total_signups} referral${stats.total_signups === 1 ? '' : 's'}, but they haven't made any payments yet. Commissions will appear here once your referrals subscribe to a paid plan.`
                  : 'Start sharing your affiliate links to see referrals and commissions here.'
                }
              </p>
              <Button
                onClick={() => copyToClipboard(getAffiliateLink(), 'Signup link')}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Copy Signup Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PayoutRequestForm 
          affiliateId={affiliateData.id}
          userEmail={affiliateData.email}
          onPayoutCreated={() => {
            // Refresh stats when payout is created
            fetchAffiliateData();
          }}
        />
        <PayoutHistory affiliateId={affiliateData.id} />
      </div>

      {/* Affiliate Info */}
      <Card>
        <CardHeader>
          <CardTitle>Affiliate Information</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Commission Rate</p>
              <p className="text-lg font-semibold text-green-600">
                {affiliateData.commission_rate}%
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Affiliate Since</p>
              <p className="text-lg">
                {new Date(affiliateData.date_applied).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <Badge className="bg-green-100 text-green-800">
                {affiliateData.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Last Referral</p>
              <p className="text-lg">
                {stats.total_signups > 0 ? `${stats.total_signups} referrals` : 'No referrals yet'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateDashboard;
