import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  User, 
  Mail, 
  Globe, 
  Building, 
  Calendar,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

interface AffiliateApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  country: string;
  website: string;
  company_name: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  twitter_url: string;
  linkedin_url: string;
  twitch_url: string;
  tiktok_url: string;
  promotion_plan: string;
  additional_info: string;
  email_agreement: boolean;
  terms_agreement: boolean;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
}

export const AffiliateApplications: React.FC = () => {
  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();

  // Fetch applications
  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Handle approval
  const handleApprove = async (applicationId: string) => {
    setProcessing(applicationId);
    try {
      // Update application status
      const { error: updateError } = await supabase
        .from('affiliate_applications')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      // Get the application data
      const application = applications.find(app => app.id === applicationId);
      if (!application) throw new Error('Application not found');

      // Generate unique referral code
      const referralCode = generateReferralCode();

      // Create affiliate record
      const { error: affiliateError } = await supabase
        .from('affiliates')
        .insert([{
          name: `${application.first_name} ${application.last_name}`.trim(),
          email: application.email,
          status: 'active',
          referral_code: referralCode,
          commission_rate: 30, // 30% commission
          date_applied: application.created_at
        }]);

      if (affiliateError) throw affiliateError;

      // Refresh applications
      await fetchApplications();

      toast({
        title: "Success",
        description: "Affiliate application approved and affiliate created",
      });

    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: "Error",
        description: "Failed to approve application",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  // Handle denial
  const handleDeny = async (applicationId: string) => {
    setProcessing(applicationId);
    try {
      const { error } = await supabase
        .from('affiliate_applications')
        .update({ 
          status: 'denied',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Refresh applications
      await fetchApplications();

      toast({
        title: "Success",
        description: "Affiliate application denied",
      });

    } catch (error) {
      console.error('Error denying application:', error);
      toast({
        title: "Error",
        description: "Failed to deny application",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
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

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>;
      case 'denied':
        return <Badge variant="outline" className="text-red-600 border-red-600">Denied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Applications</h1>
          <p className="text-gray-600 mt-1">Review and manage affiliate applications</p>
        </div>
        <div className="text-sm text-gray-500">
          {applications.length} total applications
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">No applications found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {applications.map((app) => (
            <Card key={app.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{`${app.first_name} ${app.last_name}`}</CardTitle>
                      <CardDescription className="flex items-center space-x-2">
                        <Mail className="w-4 h-4" />
                        <span>{app.email}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(app.status)}
                    <span className="text-sm text-gray-500">
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {app.company_name && (
                    <div className="flex items-center space-x-2">
                      <Building className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{app.company_name}</span>
                    </div>
                  )}
                  {app.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-gray-500" />
                      <a 
                        href={app.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center space-x-1"
                      >
                        <span>Website</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Social Media Links */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Social Media</h4>
                  <div className="flex flex-wrap gap-2">
                    {app.instagram_url && (
                      <a
                        href={app.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>Instagram</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {app.facebook_url && (
                      <a
                        href={app.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>Facebook</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {app.youtube_url && (
                      <a
                        href={app.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {app.twitter_url && (
                      <a
                        href={app.twitter_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>Twitter</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {app.linkedin_url && (
                      <a
                        href={app.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>LinkedIn</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {app.twitch_url && (
                      <a
                        href={app.twitch_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>Twitch</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {app.tiktok_url && (
                      <a
                        href={app.tiktok_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                      >
                        <span>TikTok</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Promotion Plan */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Promotion Plan</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {app.promotion_plan}
                  </p>
                </div>

                {/* Additional Info */}
                {app.additional_info && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Additional Information</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {app.additional_info}
                    </p>
                  </div>
                )}

                {/* Admin Actions */}
                {app.status === 'pending' && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-3">Admin Actions</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Admin Notes (optional)
                        </label>
                        <Textarea
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Add notes about this application..."
                          className="w-full"
                        />
                      </div>
                      
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => handleApprove(app.id)}
                          disabled={processing === app.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {processing === app.id ? 'Processing...' : 'Approve'}
                        </Button>
                        
                        <Button
                          onClick={() => handleDeny(app.id)}
                          disabled={processing === app.id}
                          variant="destructive"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {processing === app.id ? 'Processing...' : 'Deny'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review Info */}
                {app.status !== 'pending' && (
                  <div className="pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {app.status === 'approved' ? 'Approved' : 'Denied'} on{' '}
                          {new Date(app.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};