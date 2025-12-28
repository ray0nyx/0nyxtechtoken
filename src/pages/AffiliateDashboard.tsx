import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  ExternalLink, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Calendar,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { supabase } from '@/lib/supabase';

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  commission_rate: number;
  status: string;
  date_applied: string;
}

interface Commission {
  id: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
  user_id: string;
}

interface CommissionSummary {
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  totalReferrals: number;
  thisMonthCommissions: number;
}

export default function AffiliateDashboard() {
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    totalCommissions: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    totalReferrals: 0,
    thisMonthCommissions: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { theme } = useTheme();

  // Get current user
  const [user, setUser] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Debug: User fetched in AffiliateDashboard:', user);
      setUser(user);
    };
    getUser();
  }, []);

  // Fetch affiliate data and commissions
  useEffect(() => {
    if (!user) return;

    const fetchAffiliateData = async () => {
      try {
        setIsLoading(true);
        
        console.log('Debug: Current user email:', user.email);
        
        // Get affiliate data
        const { data: affiliate, error: affiliateError } = await supabase
          .from('affiliates')
          .select('*')
          .eq('email', user.email)
          .eq('status', 'active')
          .single();

        console.log('Debug: Affiliate query result:', { affiliate, affiliateError });

        if (affiliateError) {
          console.error('Error fetching affiliate data:', affiliateError);
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        if (!affiliate) {
          console.log('Debug: No affiliate found for email:', user.email);
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        console.log('Debug: Affiliate found, setting access to true');
        setAffiliateData(affiliate);
        setHasAccess(true);

        // Get commissions
        const { data: commissionData, error: commissionError } = await supabase
          .from('commissions')
          .select('*')
          .eq('affiliate_id', affiliate.id)
          .order('created_at', { ascending: false });

        if (commissionError) {
          console.error('Error fetching commissions:', commissionError);
        } else {
          setCommissions(commissionData || []);
        }

        // Calculate summary
        const totalCommissions = commissionData?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
        const pendingCommissions = commissionData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0) || 0;
        const paidCommissions = commissionData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0) || 0;
        
        // Get total referrals
        const { data: referrals } = await supabase
          .from('referrals')
          .select('id')
          .eq('affiliate_id', affiliate.id);

        // Get this month's commissions
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const thisMonthCommissions = commissionData?.filter(c => 
          new Date(c.created_at) >= thisMonth
        ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;

        setSummary({
          totalCommissions,
          pendingCommissions,
          paidCommissions,
          totalReferrals: referrals?.length || 0,
          thisMonthCommissions
        });

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load affiliate data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAffiliateData();
  }, [user, toast]);

  // Copy referral link to clipboard
  const copyReferralLink = () => {
    if (!affiliateData) return;
    
    const referralLink = `${window.location.origin}/?ref=${affiliateData.referral_code}`;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
      case 'paid':
        return <Badge variant="outline" className="text-green-600 border-green-600">Paid</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-600 border-red-600">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
    console.log('Debug: Rendering access denied. State:', { hasAccess, isLoading, user: user?.email });
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 
            className="text-2xl font-bold mb-2"
            style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
          >
            Access Denied
          </h2>
          <p 
            className="mb-4"
            style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
          >
            You need to be an approved affiliate to access this dashboard.
          </p>
          <p 
            className="text-sm"
            style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }}
          >
            If you believe this is an error, please contact support.
          </p>
          <p 
            className="text-xs mt-2"
            style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }}
          >
            Debug: User email: {user?.email || 'No user'}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!affiliateData) {
    return (
      <div className="p-6">
        <Card 
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardContent className="p-6 text-center">
            <h2 
              className="text-xl font-semibold mb-2"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              Not an Affiliate
            </h2>
            <p 
              className="mb-4"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              You are not currently an active affiliate.
            </p>
            <Button 
              onClick={() => window.location.href = '/affiliate-signup'}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20"
            >
              Apply to Become an Affiliate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/?ref=${affiliateData.referral_code}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 
          className="text-3xl font-bold text-purple-500"
        >
          Affiliate Dashboard - UPDATED
        </h1>
        <p 
          className="mt-1"
          style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
        >
          Track your referrals and earnings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle 
              className="text-sm font-medium"
              style={{ 
                color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)',
                backgroundColor: theme === 'dark' ? 'transparent' : 'lime',
                border: '2px solid blue'
              }}
            >
              Total Earnings - UPDATED
            </CardTitle>
            <DollarSign 
              className="h-4 w-4"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              ${summary.totalCommissions.toFixed(2)}
            </div>
            <p 
              className="text-xs"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              +${summary.thisMonthCommissions.toFixed(2)} this month
            </p>
          </CardContent>
        </Card>

        <Card 
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle 
              className="text-sm font-medium"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              Pending
            </CardTitle>
            <Clock 
              className="h-4 w-4"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              ${summary.pendingCommissions.toFixed(2)}
            </div>
            <p 
              className="text-xs"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              Awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card 
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle 
              className="text-sm font-medium"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              Total Referrals
            </CardTitle>
            <Users 
              className="h-4 w-4"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
            >
              {summary.totalReferrals}
            </div>
            <p 
              className="text-xs"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              Successful referrals
            </p>
          </CardContent>
        </Card>

        <Card 
          style={{ 
            backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)', // dark: slate-900/50, light: gray-100
            backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle 
              className="text-sm font-medium"
              style={{ color: '#9333ea' }}
            >
              Commission Rate
            </CardTitle>
            <TrendingUp 
              className="h-4 w-4"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            />
          </CardHeader>
          <CardContent>
            <div 
              className="text-2xl font-bold"
              style={{ color: '#9333ea' }}
            >
              {affiliateData.commission_rate}%
            </div>
            <p 
              className="text-xs"
              style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
            >
              Per successful referral
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <Card 
        style={{ 
          backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
          backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
        }}
      >
        <CardHeader>
          <CardTitle 
            style={{ color: '#9333ea' }}
          >
            Your Referral Link
          </CardTitle>
          <CardDescription 
            style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
          >
            Share this link to earn commissions when people sign up and subscribe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div 
              className="flex-1 p-3 rounded-lg border"
              style={{
                backgroundColor: theme === 'dark' ? 'rgb(30 41 59 / 0.3)' : 'rgb(249 250 251)',
                borderColor: theme === 'dark' ? 'rgb(51 65 85)' : 'rgb(229 231 235)',
              }}
            >
              <code 
                className="text-sm break-all"
                style={{ color: '#9333ea !important', fontWeight: 'bold' }}
              >
                {referralLink}
              </code>
            </div>
            <Button onClick={copyReferralLink} size="sm" className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20">
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
          <p 
            className="text-sm mt-2"
            style={{ color: '#9333ea' }}
          >
            When someone clicks your link and subscribes, you'll earn {affiliateData.commission_rate}% commission!
          </p>
        </CardContent>
      </Card>

      {/* Recent Commissions */}
      <Card 
        style={{ 
          backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
          backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
        }}
      >
        <CardHeader>
          <CardTitle 
            style={{ color: '#9333ea' }}
          >
            Recent Commissions
          </CardTitle>
          <CardDescription 
            style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
          >
            Your latest earnings from referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div 
              className="text-center py-8"
              style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }}
            >
              <BarChart3 
                className="h-12 w-12 mx-auto mb-4"
                style={{ color: theme === 'dark' ? 'rgb(156 163 175)' : 'rgb(156 163 175)' }}
              />
              <p style={{ color: '#9333ea' }}>No commissions yet</p>
              <p 
                className="text-sm"
                style={{ color: '#9333ea' }}
              >
                Start sharing your referral link to earn commissions!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {commissions.slice(0, 10).map((commission) => (
                <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p 
                        className="font-medium"
                        style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
                      >
                        {commission.description}
                      </p>
                      <p 
                        className="text-sm"
                        style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(107 114 128)' }}
                      >
                        {new Date(commission.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p 
                      className="font-semibold"
                      style={{ color: theme === 'dark' ? 'rgb(34 197 94)' : 'rgb(34 197 94)' }}
                    >
                      +${Number(commission.amount).toFixed(2)}
                    </p>
                    {getStatusBadge(commission.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card 
        style={{ 
          backgroundColor: theme === 'dark' ? 'rgb(15 23 42 / 0.5)' : 'rgb(243 244 246)',
          backgroundImage: theme === 'dark' ? 'linear-gradient(to bottom right, rgb(15 23 42 / 0.5), rgb(30 41 59 / 0.3))' : 'none'
        }}
      >
        <CardHeader>
          <CardTitle 
            style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
          >
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="h-6 w-6 text-blue-600" />
              </div>
              <h3 
                className="font-semibold mb-2"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                Share Your Link
              </h3>
              <p 
                className="text-sm"
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                Share your unique referral link on social media, your website, or with friends
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 
                className="font-semibold mb-2"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                They Sign Up
              </h3>
              <p 
                className="text-sm"
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                When someone clicks your link and creates an account, they're linked to you
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h3 
                className="font-semibold mb-2"
                style={{ color: theme === 'dark' ? 'rgb(255 255 255)' : 'rgb(17 24 39)' }}
              >
                Earn Commission
              </h3>
              <p 
                className="text-sm"
                style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
              >
                When they subscribe, you earn {affiliateData.commission_rate}% commission automatically
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
