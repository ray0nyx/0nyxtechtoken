import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Copy,
  ExternalLink,
  Calendar,
  BarChart3,
  Link
} from "lucide-react";
import { affiliateDashboardService } from "@/services/affiliateDashboardService";

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  status: string;
  referral_code: string;
  commission_rate: number;
  date_applied: string;
}

interface ReferralData {
  id: string;
  user_id: string;
  commission_amount: number;
  status: string;
  date: string;
  users: {
    id: string;
    email: string;
    created_at: string;
  };
}

interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  totalReferrals: number;
  activeReferrals: number;
}

export function AffiliateDashboard() {
  const { toast } = useToast();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary>({
    totalEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    totalReferrals: 0,
    activeReferrals: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Get affiliate dashboard data
  const fetchDashboardData = async () => {
    try {
      const data = await affiliateDashboardService.getDashboardData();
      setAffiliateData(data.affiliate);
      setReferrals(data.referrals);
      setEarningsSummary(data.earningsSummary);
    } catch (error) {
      if (error instanceof Error && error.message === 'Affiliate not found or not active') {
        setAffiliateData(null);
      } else {
        console.error('Error in fetchDashboardData:', error);
        toast({
          title: "Error",
          description: "Failed to load affiliate data",
          variant: "destructive",
        });
      }
    }
  };

  // Test mode - show sample data for demonstration
  const enableTestMode = () => {
    const testAffiliateData = {
      id: 'test-id',
      name: 'Test Affiliate',
      email: 'test@example.com',
      status: 'active',
      referral_code: 'TEST123',
      commission_rate: 30,
      date_applied: new Date().toISOString()
    };

    const testReferrals = [
      {
        id: 'ref-1',
        user_id: 'user-1',
        commission_amount: 45.00,
        status: 'paid',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        users: {
          id: 'user-1',
          email: 'john@example.com',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        id: 'ref-2',
        user_id: 'user-2',
        commission_amount: 30.00,
        status: 'pending',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        users: {
          id: 'user-2',
          email: 'jane@example.com',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        id: 'ref-3',
        user_id: 'user-3',
        commission_amount: 60.00,
        status: 'pending',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        users: {
          id: 'user-3',
          email: 'mike@example.com',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    ];

    const testEarningsSummary = {
      totalEarnings: 135.00,
      pendingEarnings: 90.00,
      paidEarnings: 45.00,
      totalReferrals: 3,
      activeReferrals: 2
    };

    setAffiliateData(testAffiliateData);
    setReferrals(testReferrals);
    setEarningsSummary(testEarningsSummary);
  };

  // Calculate earnings summary
  const calculateEarningsSummary = () => {
    if (!referrals.length) return;

    const totalEarnings = referrals.reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
    const pendingEarnings = referrals
      .filter(ref => ref.status === 'pending')
      .reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
    const paidEarnings = referrals
      .filter(ref => ref.status === 'paid')
      .reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(ref => ref.status === 'pending').length;

    setEarningsSummary({
      totalEarnings,
      pendingEarnings,
      paidEarnings,
      totalReferrals,
      activeReferrals
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchDashboardData();
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Copy affiliate link to clipboard
  const copyAffiliateLink = async () => {
    if (!affiliateData) return;

    const success = await affiliateDashboardService.copyAffiliateLink(affiliateData.referral_code);
    
    if (success) {
      setCopied(true);
      toast({
        title: "Success",
        description: "Affiliate link copied to clipboard!",
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: "Error",
        description: "Failed to copy affiliate link",
        variant: "destructive",
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    return <Badge className={affiliateDashboardService.getStatusBadgeColor(status)}>{status}</Badge>;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!affiliateData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Not an Affiliate</h2>
          <p className="text-muted-foreground mb-4">
            You are not currently enrolled in our affiliate program.
          </p>
          <div className="space-y-4">
            <Button onClick={() => window.open('/affiliate-signup', '_blank')}>
              Apply to Become an Affiliate
            </Button>
            <Button variant="outline" onClick={enableTestMode} className="ml-2">
              View Demo Dashboard
            </Button>
            <div className="text-sm text-muted-foreground">
              <p>Join our affiliate program and earn commissions for every referral!</p>
              <p className="mt-2">• Earn up to 30% commission on subscriptions</p>
              <p>• Get your unique referral link</p>
              <p>• Track your earnings in real-time</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const affiliateLink = affiliateDashboardService.generateAffiliateLink(affiliateData.referral_code);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Affiliate Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {affiliateData.name}! Track your earnings and referrals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/affiliate-signup', '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Affiliate Program
          </Button>
        </div>
      </div>

      {/* Affiliate Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Your Affiliate Link
          </CardTitle>
          <CardDescription>
            Share this link to earn commissions on new signups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
              {affiliateLink}
            </div>
            <Button onClick={copyAffiliateLink} variant="outline">
              <Copy className={`h-4 w-4 ${copied ? 'text-green-600' : ''}`} />
            </Button>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Commission Rate: {affiliateData.commission_rate}% | Status: {getStatusBadge(affiliateData.status)}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${earningsSummary.totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All time earnings
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${earningsSummary.pendingEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting payout
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${earningsSummary.paidEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Total paid out
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{earningsSummary.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              All time referrals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{earningsSummary.activeReferrals}</div>
            <p className="text-xs text-muted-foreground">
              Pending commissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="referrals" className="space-y-6">
        <TabsList>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="earnings">Earnings History</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>
                Track all users you've referred and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No referrals yet</p>
                  <p className="text-sm text-muted-foreground">
                    Share your affiliate link to start earning commissions!
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referred User</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell>{referral.users?.email || 'Unknown'}</TableCell>
                        <TableCell className="font-medium">${referral.commission_amount.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(referral.status)}</TableCell>
                        <TableCell>{new Date(referral.date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Earnings History</CardTitle>
              <CardDescription>
                Detailed breakdown of your commission earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">This Month</div>
                    <div className="text-2xl font-bold">${earningsSummary.totalEarnings.toFixed(2)}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Average per Referral</div>
                    <div className="text-2xl font-bold">
                      ${earningsSummary.totalReferrals > 0 ? (earningsSummary.totalEarnings / earningsSummary.totalReferrals).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Commission Rate</div>
                    <div className="text-2xl font-bold">{affiliateData.commission_rate}%</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                  {referrals.length === 0 ? (
                    <p className="text-muted-foreground">No recent activity</p>
                  ) : (
                    <div className="space-y-2">
                      {referrals.slice(0, 5).map((referral) => (
                        <div key={referral.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">New referral: {referral.users?.email || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(referral.date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${referral.commission_amount.toFixed(2)}</div>
                            <div className="text-sm">{getStatusBadge(referral.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 