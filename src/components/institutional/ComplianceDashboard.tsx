import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users,
  Eye,
  Download,
  Upload,
  Settings,
  BarChart3,
  Calendar,
  Lock,
  Unlock,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Info
} from 'lucide-react';

interface ComplianceRecord {
  id: string;
  type: 'trade' | 'position' | 'risk' | 'audit' | 'regulatory';
  description: string;
  timestamp: string;
  user: string;
  status: 'compliant' | 'warning' | 'violation' | 'pending';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface RegulatoryReport {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  status: 'generated' | 'pending' | 'failed';
  generatedAt: string;
  dueDate: string;
  size: string;
  format: 'PDF' | 'Excel' | 'CSV';
}

interface AuditTrail {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details: string;
  status: 'success' | 'failed' | 'warning';
}

interface KYCStatus {
  userId: string;
  name: string;
  email: string;
  status: 'verified' | 'pending' | 'expired' | 'rejected';
  lastVerified: string;
  nextReview: string;
  documents: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export const ComplianceDashboard: React.FC = () => {
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [regulatoryReports, setRegulatoryReports] = useState<RegulatoryReport[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrail[]>([]);
  const [kycStatus, setKycStatus] = useState<KYCStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadComplianceData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock compliance records
      setComplianceRecords([
        {
          id: '1',
          type: 'trade',
          description: 'Large position size detected',
          timestamp: '2024-01-22T14:30:00Z',
          user: 'John Smith',
          status: 'warning',
          severity: 'medium',
          details: 'Position size exceeds 5% of portfolio limit',
          resolution: 'Position reduced to comply with limits',
          resolvedAt: '2024-01-22T14:45:00Z',
          resolvedBy: 'Risk Manager'
        },
        {
          id: '2',
          type: 'risk',
          description: 'VaR breach alert',
          timestamp: '2024-01-22T13:15:00Z',
          user: 'Sarah Johnson',
          status: 'violation',
          severity: 'high',
          details: 'Portfolio VaR exceeded 95% confidence limit',
          resolution: 'Risk limits adjusted and positions rebalanced',
          resolvedAt: '2024-01-22T13:30:00Z',
          resolvedBy: 'Risk Manager'
        },
        {
          id: '3',
          type: 'audit',
          description: 'Trade execution audit',
          timestamp: '2024-01-22T12:00:00Z',
          user: 'System',
          status: 'compliant',
          severity: 'low',
          details: 'All trades executed within approved parameters'
        },
        {
          id: '4',
          type: 'regulatory',
          description: 'MiFID II reporting compliance',
          timestamp: '2024-01-22T10:00:00Z',
          user: 'System',
          status: 'compliant',
          severity: 'low',
          details: 'All required regulatory reports generated and submitted'
        },
        {
          id: '5',
          type: 'position',
          description: 'Concentration risk alert',
          timestamp: '2024-01-22T09:30:00Z',
          user: 'Mike Chen',
          status: 'pending',
          severity: 'medium',
          details: 'Single position represents 15% of portfolio'
        }
      ]);

      // Mock regulatory reports
      setRegulatoryReports([
        {
          id: '1',
          name: 'Daily Trade Report',
          type: 'daily',
          status: 'generated',
          generatedAt: '2024-01-22T18:00:00Z',
          dueDate: '2024-01-23T09:00:00Z',
          size: '2.3 MB',
          format: 'PDF'
        },
        {
          id: '2',
          name: 'Weekly Risk Summary',
          type: 'weekly',
          status: 'generated',
          generatedAt: '2024-01-21T17:00:00Z',
          dueDate: '2024-01-28T17:00:00Z',
          size: '5.7 MB',
          format: 'Excel'
        },
        {
          id: '3',
          name: 'Monthly Compliance Report',
          type: 'monthly',
          status: 'pending',
          generatedAt: '',
          dueDate: '2024-01-31T17:00:00Z',
          size: '0 MB',
          format: 'PDF'
        },
        {
          id: '4',
          name: 'Quarterly Regulatory Filing',
          type: 'quarterly',
          status: 'failed',
          generatedAt: '',
          dueDate: '2024-03-31T17:00:00Z',
          size: '0 MB',
          format: 'PDF'
        }
      ]);

      // Mock audit trail
      setAuditTrail([
        {
          id: '1',
          action: 'User Login',
          user: 'john.smith@example.com',
          timestamp: '2024-01-22T14:30:00Z',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          details: 'Successful login from office network',
          status: 'success'
        },
        {
          id: '2',
          action: 'Trade Execution',
          user: 'sarah.johnson@example.com',
          timestamp: '2024-01-22T14:25:00Z',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          details: 'Executed BUY 100 AAPL @ $150.25',
          status: 'success'
        },
        {
          id: '3',
          action: 'Risk Limit Override',
          user: 'mike.chen@example.com',
          timestamp: '2024-01-22T14:20:00Z',
          ipAddress: '192.168.1.102',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          details: 'Override approved for position size limit',
          status: 'warning'
        },
        {
          id: '4',
          action: 'Failed Login Attempt',
          user: 'unknown@example.com',
          timestamp: '2024-01-22T14:15:00Z',
          ipAddress: '203.0.113.1',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          details: 'Multiple failed login attempts detected',
          status: 'failed'
        }
      ]);

      // Mock KYC status
      setKycStatus([
        {
          userId: '1',
          name: 'John Smith',
          email: 'john.smith@example.com',
          status: 'verified',
          lastVerified: '2024-01-15T10:00:00Z',
          nextReview: '2024-07-15T10:00:00Z',
          documents: 5,
          riskLevel: 'low'
        },
        {
          userId: '2',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@example.com',
          status: 'verified',
          lastVerified: '2024-01-10T14:30:00Z',
          nextReview: '2024-07-10T14:30:00Z',
          documents: 4,
          riskLevel: 'low'
        },
        {
          userId: '3',
          name: 'Mike Chen',
          email: 'mike.chen@example.com',
          status: 'pending',
          lastVerified: '',
          nextReview: '2024-01-25T09:00:00Z',
          documents: 2,
          riskLevel: 'medium'
        },
        {
          userId: '4',
          name: 'Lisa Davis',
          email: 'lisa.davis@example.com',
          status: 'expired',
          lastVerified: '2023-12-01T16:00:00Z',
          nextReview: '2024-01-30T16:00:00Z',
          documents: 3,
          riskLevel: 'high'
        }
      ]);

      setIsLoading(false);
    };

    loadComplianceData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'verified':
      case 'success':
      case 'generated':
        return 'text-green-400';
      case 'warning':
      case 'pending':
        return 'text-yellow-400';
      case 'violation':
      case 'failed':
      case 'expired':
        return 'text-red-400';
      case 'rejected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'verified':
      case 'success':
      case 'generated':
        return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'warning':
      case 'pending':
        return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'violation':
      case 'failed':
      case 'expired':
        return 'bg-red-900/20 border-red-500/30 text-red-400';
      case 'rejected':
        return 'bg-red-900/20 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      case 'high':
        return 'text-orange-400';
      case 'critical':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'medium':
        return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'high':
        return 'bg-orange-900/20 border-orange-500/30 text-orange-400';
      case 'critical':
        return 'bg-red-900/20 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="institutional-theme p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="institutional-theme p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Compliance Dashboard</h1>
          <p className="text-gray-400 mt-1">Regulatory compliance, audit trails, and risk monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <Download className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="institutional-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Shield className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-400">Compliance Rate</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {((complianceRecords.filter(r => r.status === 'compliant').length / complianceRecords.length) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">
              {complianceRecords.filter(r => r.status === 'compliant').length} of {complianceRecords.length} records
            </div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Active Alerts</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {complianceRecords.filter(r => r.status === 'warning' || r.status === 'violation').length}
            </div>
            <div className="text-sm text-gray-400">Requires attention</div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-gray-400">Reports Generated</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {regulatoryReports.filter(r => r.status === 'generated').length}
            </div>
            <div className="text-sm text-gray-400">This month</div>
          </CardContent>
        </Card>

        <Card className="institutional-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-gray-400">KYC Verified</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {kycStatus.filter(k => k.status === 'verified').length}
            </div>
            <div className="text-sm text-gray-400">of {kycStatus.length} users</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compliance" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="compliance">Compliance Records</TabsTrigger>
          <TabsTrigger value="reports">Regulatory Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="kyc">KYC Status</TabsTrigger>
        </TabsList>

        {/* Compliance Records Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="space-y-4">
            {complianceRecords.map((record) => (
              <Card key={record.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{record.description}</h4>
                      <Badge className={getStatusBadgeColor(record.status)}>
                        {record.status.toUpperCase()}
                      </Badge>
                      <Badge className={getSeverityBadgeColor(record.severity)}>
                        {record.severity.toUpperCase()}
                      </Badge>
                      <Badge className="bg-gray-700 text-gray-300">
                        {record.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {formatDate(record.timestamp)}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-sm text-gray-400 mb-1">Details</div>
                    <div className="text-white">{record.details}</div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      User: <span className="text-white">{record.user}</span>
                    </div>
                    {record.resolution && (
                      <div className="text-sm text-gray-400">
                        Resolved by: <span className="text-white">{record.resolvedBy}</span>
                      </div>
                    )}
                  </div>
                  
                  {record.resolution && (
                    <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-400 mb-1">Resolution</div>
                      <div className="text-white">{record.resolution}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Regulatory Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="space-y-4">
            {regulatoryReports.map((report) => (
              <Card key={report.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{report.name}</h4>
                      <Badge className={getStatusBadgeColor(report.status)}>
                        {report.status.toUpperCase()}
                      </Badge>
                      <Badge className="bg-gray-700 text-gray-300">
                        {report.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      Due: {formatDate(report.dueDate)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-400">Format</div>
                      <div className="text-white">{report.format}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Size</div>
                      <div className="text-white">{report.size}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Generated</div>
                      <div className="text-white">
                        {report.generatedAt ? formatDate(report.generatedAt) : 'Not generated'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Status</div>
                      <div className={`${getStatusColor(report.status)}`}>
                        {report.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {report.status === 'generated' && (
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="space-y-4">
            {auditTrail.map((audit) => (
              <Card key={audit.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{audit.action}</h4>
                      <Badge className={getStatusBadgeColor(audit.status)}>
                        {audit.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {formatDate(audit.timestamp)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-400">User</div>
                      <div className="text-white">{audit.user}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">IP Address</div>
                      <div className="text-white font-mono">{audit.ipAddress}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Details</div>
                      <div className="text-white">{audit.details}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">User Agent</div>
                      <div className="text-white text-xs truncate">{audit.userAgent}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* KYC Status Tab */}
        <TabsContent value="kyc" className="space-y-4">
          <div className="space-y-4">
            {kycStatus.map((kyc) => (
              <Card key={kyc.userId} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{kyc.name}</h4>
                      <Badge className={getStatusBadgeColor(kyc.status)}>
                        {kyc.status.toUpperCase()}
                      </Badge>
                      <Badge className={getSeverityBadgeColor(kyc.riskLevel)}>
                        {kyc.riskLevel.toUpperCase()} RISK
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {kyc.email}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-400">Last Verified</div>
                      <div className="text-white">
                        {kyc.lastVerified ? formatDate(kyc.lastVerified) : 'Never'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Next Review</div>
                      <div className="text-white">{formatDate(kyc.nextReview)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Documents</div>
                      <div className="text-white">{kyc.documents}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Risk Level</div>
                      <div className={`${getSeverityColor(kyc.riskLevel)}`}>
                        {kyc.riskLevel.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Eye className="h-4 w-4 mr-1" />
                      View Documents
                    </Button>
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};