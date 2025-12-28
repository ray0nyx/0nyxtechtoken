import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  DollarSign, 
  TrendingUp,
  Calendar,
  Filter,
  Download,
  Check,
  X
} from "lucide-react";

interface Affiliate {
  id: string;
  name: string;
  email: string;
  status: string;
  referral_code: string;
  commission_rate: number;
  date_applied: string;
}

interface Referral {
  id: string;
  affiliate_id: string;
  user_id: string;
  commission_amount: number;
  status: string;
  date: string;
}

interface CommissionSummary {
  totalReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  byAffiliate: Record<string, any>;
}

export function AdminAffiliates() {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Form states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    status: "pending",
    referral_code: "",
    commission_rate: 10
  });

  // Fetch affiliates
  const fetchAffiliates = async () => {
    try {
          let query = supabase
            .from('affiliates')
            .select('*')
            .order('date_applied', { ascending: false });

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching affiliates:', error);
        throw error;
      }

      setAffiliates(data || []);
      setTotalPages(1); // Simplified pagination for now
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      toast({
        title: "Error",
        description: "Failed to load affiliates",
        variant: "destructive",
      });
      setAffiliates([]);
      setTotalPages(1);
    }
  };

  // Fetch referrals and commission summary
  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching referrals:', error);
        throw error;
      }

      setReferrals(data || []);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      setReferrals([]);
    }
  };

  const fetchCommissionSummary = async () => {
    try {
      // Get all commissions
      const { data: commissions, error: commissionsError } = await supabase
        .from('commissions')
        .select('*');

      if (commissionsError) {
        console.error('Error fetching commissions:', commissionsError);
        throw commissionsError;
      }

      // Get all referrals
      const { data: referrals, error: referralsError } = await supabase
        .from('referrals')
        .select('*');

      if (referralsError) {
        console.error('Error fetching referrals for summary:', referralsError);
        throw referralsError;
      }

      // Calculate summary
      const totalReferrals = referrals?.length || 0;
      const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const pendingCommissions = commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const paidCommissions = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      // Group by affiliate
      const byAffiliate = {};
      
      // First, get all affiliate data
      const { data: allAffiliates } = await supabase
        .from('affiliates')
        .select('id, name, commission_rate');
      
      // Create affiliate lookup
      const affiliateLookup = {};
      if (allAffiliates) {
        for (const affiliate of allAffiliates) {
          affiliateLookup[affiliate.id] = {
            name: affiliate.name,
            commission_rate: affiliate.commission_rate
          };
        }
      }
      
      if (commissions) {
        for (const commission of commissions) {
          if (!byAffiliate[commission.affiliate_id]) {
            byAffiliate[commission.affiliate_id] = {
              totalReferrals: 0,
              totalCommissions: 0,
              pendingCommissions: 0,
              paidCommissions: 0,
              affiliate: affiliateLookup[commission.affiliate_id] || { name: 'Unknown', commission_rate: 0 }
            };
          }
          byAffiliate[commission.affiliate_id].totalCommissions += Number(commission.amount);
          if (commission.status === 'pending') {
            byAffiliate[commission.affiliate_id].pendingCommissions += Number(commission.amount);
          } else if (commission.status === 'paid') {
            byAffiliate[commission.affiliate_id].paidCommissions += Number(commission.amount);
          }
        }
      }

      // Add referral counts
      if (referrals) {
        for (const referral of referrals) {
          if (byAffiliate[referral.affiliate_id]) {
            byAffiliate[referral.affiliate_id].totalReferrals += 1;
          }
        }
      }

      setCommissionSummary({
        totalReferrals,
        totalCommissions,
        pendingCommissions,
        paidCommissions,
        byAffiliate
      });
    } catch (error) {
      console.error('Error fetching commission summary:', error);
      setCommissionSummary({
        totalReferrals: 0,
        totalCommissions: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        byAffiliate: {}
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchAffiliates(),
        fetchReferrals(),
        fetchCommissionSummary()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [currentPage, statusFilter, searchTerm]);

  // Add a test affiliate if none exist (for development/testing)
  const addTestAffiliate = async () => {
    try {
      const testData = {
        name: "Test Affiliate",
        email: "test@example.com",
        status: "active",
        referral_code: "TEST1234",
        commission_rate: 30
      };

      const { data, error } = await supabase
        .from('affiliates')
        .insert([{
          name: testData.name,
          email: testData.email,
          status: testData.status,
          referral_code: testData.referral_code,
          commission_rate: testData.commission_rate,
          date_applied: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating test affiliate:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Test affiliate created successfully",
      });
      fetchAffiliates();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create test affiliate",
        variant: "destructive",
      });
    }
  };

  // Create affiliate
  const handleCreateAffiliate = async () => {
    try {
      console.log('Submitting affiliate data:', formData);
      
      const { data, error } = await supabase
        .from('affiliates')
        .insert([{
          name: formData.name,
          email: formData.email,
          status: formData.status,
          referral_code: formData.referral_code || generateReferralCode(),
          commission_rate: formData.commission_rate,
          date_applied: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating affiliate:', error);
        throw error;
      }

      console.log('Success response:', data);
      
      toast({
        title: "Success",
        description: "Affiliate created successfully",
      });
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        email: "",
        status: "pending",
        referral_code: "",
        commission_rate: 10
      });
      fetchAffiliates();
    } catch (error) {
      console.error('Error creating affiliate:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create affiliate",
        variant: "destructive",
      });
    }
  };

  // Generate unique referral code
  const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Update affiliate
  const handleUpdateAffiliate = async () => {
    if (!editingAffiliate) return;

    try {
      const { data, error } = await supabase
        .from('affiliates')
        .update({
          name: formData.name,
          email: formData.email,
          status: formData.status,
          referral_code: formData.referral_code,
          commission_rate: formData.commission_rate,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAffiliate.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating affiliate:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Affiliate updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingAffiliate(null);
      fetchAffiliates();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update affiliate",
        variant: "destructive",
      });
    }
  };

  // Delete affiliate
  const handleDeleteAffiliate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this affiliate?')) return;

    try {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting affiliate:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Affiliate deleted successfully",
      });
      fetchAffiliates();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete affiliate",
        variant: "destructive",
      });
    }
  };

  // Edit affiliate
  const handleEdit = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate);
    setFormData({
      name: affiliate.name,
      email: affiliate.email,
      status: affiliate.status,
      referral_code: affiliate.referral_code,
      commission_rate: affiliate.commission_rate
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      inactive: "bg-red-100 text-red-800"
    };
    return <Badge className={variants[status as keyof typeof variants] || "bg-gray-100 text-gray-800"}>{status}</Badge>;
  };

  // Handler functions
  const handleApproveAffiliate = async (affiliate: Affiliate) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({
          status: 'active',
          referral_code: affiliate.referral_code || generateReferralCode(),
          updated_at: new Date().toISOString()
        })
        .eq('id', affiliate.id);

      if (error) {
        console.error('Error approving affiliate:', error);
        throw error;
      }

      toast({ title: 'Affiliate approved', description: `${affiliate.name} is now active.` });
      fetchAffiliates();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to approve affiliate', variant: 'destructive' });
    }
  };
  const handleDenyAffiliate = async (affiliate: Affiliate) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', affiliate.id);

      if (error) {
        console.error('Error denying affiliate:', error);
        throw error;
      }

      toast({ title: 'Affiliate denied', description: `${affiliate.name} was denied.` });
      fetchAffiliates();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to deny affiliate', variant: 'destructive' });
    }
  };
  const handleRemoveAffiliate = async (affiliate: Affiliate) => {
    if (!window.confirm(`Remove affiliate ${affiliate.name}? This will disable their code for new signups.`)) return;
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({
          status: 'removed',
          updated_at: new Date().toISOString()
        })
        .eq('id', affiliate.id);

      if (error) {
        console.error('Error removing affiliate:', error);
        throw error;
      }

      toast({ title: 'Affiliate removed', description: `${affiliate.name} was removed.` });
      fetchAffiliates();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove affiliate', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Affiliate Management</h1>
          <p className="text-muted-foreground">
            Manage affiliates, track referrals, and process commissions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Affiliate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Affiliate</DialogTitle>
              <DialogDescription>
                Create a new affiliate account with referral code and commission rate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="referral_code">Referral Code</Label>
                <Input
                  id="referral_code"
                  value={formData.referral_code}
                  onChange={(e) => setFormData({ ...formData, referral_code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAffiliate} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20">Create Affiliate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Affiliates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{affiliates.length}</div>
            <p className="text-xs text-muted-foreground">
              {affiliates.filter(a => a.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commissionSummary?.totalReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${commissionSummary?.totalCommissions || 0}</div>
            <p className="text-xs text-muted-foreground">
              ${commissionSummary?.pendingCommissions || 0} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${commissionSummary?.paidCommissions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total paid out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="affiliates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search affiliates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Affiliates Table */}
          <Card>
            <CardHeader>
              <CardTitle>Affiliates</CardTitle>
              <CardDescription>
                Manage affiliate accounts and their settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {affiliates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No affiliates found</p>
                  <Button onClick={addTestAffiliate} variant="outline">
                    Create Test Affiliate
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Commission Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((affiliate) => (
                      <TableRow key={affiliate.id}>
                        <TableCell className="font-medium">{affiliate.name}</TableCell>
                        <TableCell>{affiliate.email}</TableCell>
                        <TableCell className="font-mono">{affiliate.referral_code || '-'}</TableCell>
                        <TableCell>{affiliate.commission_rate}%</TableCell>
                        <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                        <TableCell>{new Date(affiliate.date_applied).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            {affiliate.status === 'pending' ? (
                              <>
                                <Button
                                  className="rounded-full px-6 py-2 bg-green-500 hover:bg-green-600 text-white flex items-center"
                                  onClick={() => handleApproveAffiliate(affiliate)}
                                  title="Approve"
                                >
                                  <Check className="h-5 w-5" />
                                </Button>
                                <Button
                                  className="rounded-full px-6 py-2 bg-red-500 hover:bg-red-600 text-white flex items-center"
                                  onClick={() => handleDenyAffiliate(affiliate)}
                                  title="Deny"
                                >
                                  <X className="h-5 w-5" />
                                </Button>
                              </>
                            ) : affiliate.status === 'active' ? (
                              <span className="text-green-700 font-semibold">Approved</span>
                            ) : affiliate.status === 'inactive' ? (
                              <span className="text-red-700 font-semibold">Denied</span>
                            ) : affiliate.status === 'removed' ? (
                              <span className="text-gray-500 font-semibold">Removed</span>
                            ) : null}
                            {/* Remove button for all except removed */}
                            {affiliate.status !== 'removed' && (
                              <Button
                                className="rounded-full px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 flex items-center"
                                onClick={() => handleRemoveAffiliate(affiliate)}
                                title="Remove Affiliate"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referrals</CardTitle>
              <CardDescription>
                Track all referrals and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Referred User</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>{referral.affiliate_id}</TableCell>
                      <TableCell>{referral.user_id}</TableCell>
                      <TableCell>${referral.commission_amount}</TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell>{new Date(referral.date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commission Summary</CardTitle>
              <CardDescription>
                Overview of commission earnings by affiliate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissionSummary && Object.entries(commissionSummary.byAffiliate).map(([affiliateId, data]) => (
                <div key={affiliateId} className="border rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{data.affiliate.name}</h3>
                    <Badge>{data.affiliate.commission_rate}% rate</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Referrals:</span>
                      <span className="ml-2 font-medium">{data.totalReferrals}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pending:</span>
                      <span className="ml-2 font-medium">${data.pendingCommissions}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="ml-2 font-medium">${data.paidCommissions}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Affiliate</DialogTitle>
            <DialogDescription>
              Update affiliate information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-referral_code">Referral Code</Label>
              <Input
                id="edit-referral_code"
                value={formData.referral_code}
                onChange={(e) => setFormData({ ...formData, referral_code: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-commission_rate">Commission Rate (%)</Label>
              <Input
                id="edit-commission_rate"
                type="number"
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAffiliate} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20">Update Affiliate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 