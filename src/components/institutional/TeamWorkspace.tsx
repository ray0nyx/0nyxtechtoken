import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Settings, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Shield,
  Activity,
  Zap,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'trader' | 'analyst' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  lastActive: string;
  permissions: string[];
  performance: {
    totalTrades: number;
    winRate: number;
    pnl: number;
    sharpeRatio: number;
  };
}

interface TradeApproval {
  id: string;
  traderId: string;
  traderName: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalValue: number;
  strategy: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  comments: string;
}

interface TeamDiscussion {
  id: string;
  author: string;
  authorRole: string;
  content: string;
  timestamp: string;
  type: 'trade_idea' | 'market_analysis' | 'strategy_discussion' | 'general';
  replies: number;
  likes: number;
}

export const TeamWorkspace: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tradeApprovals, setTradeApprovals] = useState<TradeApproval[]>([]);
  const [discussions, setDiscussions] = useState<TeamDiscussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTeamData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data - in production, this would come from your database
      setTeamMembers([
        {
          id: '1',
          name: 'John Smith',
          email: 'john@example.com',
          role: 'admin',
          status: 'active',
          lastActive: '2024-01-22T14:30:00Z',
          permissions: ['trade', 'approve', 'manage_team', 'view_all'],
          performance: {
            totalTrades: 45,
            winRate: 0.72,
            pnl: 125000,
            sharpeRatio: 1.85
          }
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          role: 'trader',
          status: 'active',
          lastActive: '2024-01-22T14:25:00Z',
          permissions: ['trade', 'view_own'],
          performance: {
            totalTrades: 32,
            winRate: 0.68,
            pnl: 89000,
            sharpeRatio: 1.42
          }
        },
        {
          id: '3',
          name: 'Mike Chen',
          email: 'mike@example.com',
          role: 'analyst',
          status: 'active',
          lastActive: '2024-01-22T14:20:00Z',
          permissions: ['view_all', 'analyze'],
          performance: {
            totalTrades: 0,
            winRate: 0,
            pnl: 0,
            sharpeRatio: 0
          }
        },
        {
          id: '4',
          name: 'Lisa Davis',
          email: 'lisa@example.com',
          role: 'viewer',
          status: 'pending',
          lastActive: '2024-01-22T10:15:00Z',
          permissions: ['view_own'],
          performance: {
            totalTrades: 0,
            winRate: 0,
            pnl: 0,
            sharpeRatio: 0
          }
        }
      ]);

      setTradeApprovals([
        {
          id: '1',
          traderId: '2',
          traderName: 'Sarah Johnson',
          symbol: 'AAPL',
          side: 'buy',
          quantity: 100,
          price: 150.25,
          totalValue: 15025,
          strategy: 'Momentum',
          reason: 'Strong earnings beat and positive guidance',
          status: 'pending',
          submittedAt: '2024-01-22T14:15:00Z',
          comments: ''
        },
        {
          id: '2',
          traderId: '2',
          traderName: 'Sarah Johnson',
          symbol: 'TSLA',
          side: 'sell',
          quantity: 50,
          price: 220.50,
          totalValue: 11025,
          strategy: 'Mean Reversion',
          reason: 'Overbought conditions, taking profits',
          status: 'approved',
          submittedAt: '2024-01-22T13:45:00Z',
          reviewedAt: '2024-01-22T14:00:00Z',
          reviewedBy: 'John Smith',
          comments: 'Good risk management, approved'
        },
        {
          id: '3',
          traderId: '1',
          traderName: 'John Smith',
          symbol: 'GOOGL',
          side: 'buy',
          quantity: 75,
          price: 2800.00,
          totalValue: 210000,
          strategy: 'Value',
          reason: 'Undervalued relative to peers',
          status: 'rejected',
          submittedAt: '2024-01-22T12:30:00Z',
          reviewedAt: '2024-01-22T13:00:00Z',
          reviewedBy: 'Mike Chen',
          comments: 'Position size too large for current risk limits'
        }
      ]);

      setDiscussions([
        {
          id: '1',
          author: 'John Smith',
          authorRole: 'admin',
          content: 'Market showing strong momentum in tech sector. Consider increasing exposure to growth stocks.',
          timestamp: '2024-01-22T14:00:00Z',
          type: 'market_analysis',
          replies: 3,
          likes: 5
        },
        {
          id: '2',
          author: 'Sarah Johnson',
          authorRole: 'trader',
          content: 'New momentum strategy showing 15% returns in backtesting. Ready to deploy with small position size.',
          timestamp: '2024-01-22T13:30:00Z',
          type: 'strategy_discussion',
          replies: 2,
          likes: 3
        },
        {
          id: '3',
          author: 'Mike Chen',
          authorRole: 'analyst',
          content: 'Risk metrics looking good across all strategies. VaR within acceptable limits.',
          timestamp: '2024-01-22T13:00:00Z',
          type: 'general',
          replies: 1,
          likes: 2
        }
      ]);

      setIsLoading(false);
    };

    loadTeamData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-400';
      case 'trader': return 'text-blue-400';
      case 'analyst': return 'text-green-400';
      case 'viewer': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'inactive': return 'text-gray-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'inactive': return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
      case 'pending': return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getApprovalStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'approved': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'rejected': return 'bg-red-900/20 border-red-500/30 text-red-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
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
          <h1 className="text-3xl font-bold text-white">Team Workspace</h1>
          <p className="text-gray-400 mt-1">Collaborative trading environment with approval workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="approvals">Trade Approvals</TabsTrigger>
          <TabsTrigger value="discussions">Discussions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="institutional-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  <span className="text-sm text-gray-400">Total Members</span>
                </div>
                <div className="text-2xl font-bold text-white">{teamMembers.length}</div>
                <div className="text-sm text-gray-400">
                  {teamMembers.filter(m => m.status === 'active').length} active
                </div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">Pending Approvals</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {tradeApprovals.filter(t => t.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-400">Awaiting review</div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <MessageSquare className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-gray-400">Active Discussions</span>
                </div>
                <div className="text-2xl font-bold text-white">{discussions.length}</div>
                <div className="text-sm text-gray-400">Recent activity</div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Team Performance</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatPercent(teamMembers.reduce((acc, m) => acc + m.performance.winRate, 0) / teamMembers.length)}
                </div>
                <div className="text-sm text-gray-400">Average win rate</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {member.name}
                    </CardTitle>
                    <Badge className={getStatusBadgeColor(member.status)}>
                      {member.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{member.email}</span>
                    <Badge className={`${getRoleColor(member.role)} bg-gray-800`}>
                      {member.role.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Trades</span>
                      <span className="font-mono text-lg text-blue-400">
                        {member.performance.totalTrades}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Win Rate</span>
                      <span className="font-mono text-lg text-green-400">
                        {formatPercent(member.performance.winRate)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">P&L</span>
                      <span className={`font-mono text-lg ${member.performance.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(member.performance.pnl)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Sharpe Ratio</span>
                      <span className="font-mono text-lg text-purple-400">
                        {member.performance.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">
                      Last active: {new Date(member.lastActive).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Trade Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <div className="space-y-4">
            {tradeApprovals.map((approval) => (
              <Card key={approval.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{approval.symbol}</h4>
                      <Badge className={
                        approval.side === 'buy' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                        'bg-red-900/20 border-red-500/30 text-red-400'
                      }>
                        {approval.side.toUpperCase()}
                      </Badge>
                      <Badge className={getApprovalStatusBadgeColor(approval.status)}>
                        {approval.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(approval.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Trader</div>
                      <div className="font-mono text-lg text-white">{approval.traderName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Quantity</div>
                      <div className="font-mono text-lg text-blue-400">{approval.quantity}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Price</div>
                      <div className="font-mono text-lg text-green-400">
                        {formatCurrency(approval.price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Total Value</div>
                      <div className="font-mono text-lg text-purple-400">
                        {formatCurrency(approval.totalValue)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">Strategy</div>
                    <div className="text-white">{approval.strategy}</div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">Reason</div>
                    <div className="text-white">{approval.reason}</div>
                  </div>
                  
                  {approval.comments && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-400 mb-1">Comments</div>
                      <div className="text-white">{approval.comments}</div>
                    </div>
                  )}
                  
                  {approval.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Discussions Tab */}
        <TabsContent value="discussions" className="space-y-4">
          <div className="space-y-4">
            {discussions.map((discussion) => (
              <Card key={discussion.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{discussion.author}</h4>
                      <Badge className="bg-gray-700 text-gray-300">
                        {discussion.authorRole}
                      </Badge>
                      <Badge className="bg-blue-900/20 border-blue-500/30 text-blue-400">
                        {discussion.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(discussion.timestamp).toLocaleString()}
                    </div>
                  </div>
                  
                  <p className="text-white mb-3">{discussion.content}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      {discussion.replies} replies
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {discussion.likes} likes
                    </div>
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
