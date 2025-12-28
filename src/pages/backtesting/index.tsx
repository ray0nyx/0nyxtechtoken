/**
 * Main Backtesting Page
 * QuantConnect-style interface with strategy editor and results dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Save, 
  Download, 
  Share2, 
  Settings, 
  BarChart3, 
  Code, 
  History,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import StrategyEditor from '@/components/backtesting/StrategyEditor';
import BacktestResultsDashboard from '@/components/backtesting/BacktestResultsDashboard';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

interface BacktestJob {
  id: string;
  name: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  language: 'python' | 'csharp';
  code: string;
  category: string;
  tags: string[];
  parameters: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const BacktestingPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { socket, isConnected } = useWebSocket();
  
  const [activeTab, setActiveTab] = useState('editor');
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(null);
  const [backtestJobs, setBacktestJobs] = useState<BacktestJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BacktestJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load user's strategies and backtest jobs
  useEffect(() => {
    if (user) {
      loadStrategies();
      loadBacktestJobs();
    }
  }, [user]);

  // WebSocket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleBacktestProgress = (data: any) => {
      setBacktestJobs(prev => prev.map(job => 
        job.id === data.jobId 
          ? { ...job, progress: data.progress, status: data.status }
          : job
      ));
    };

    const handleBacktestCompleted = (data: any) => {
      setBacktestJobs(prev => prev.map(job => 
        job.id === data.jobId 
          ? { 
              ...job, 
              status: 'completed', 
              progress: 100, 
              completedAt: new Date().toISOString(),
              duration: data.duration
            }
          : job
      ));
      
      toast.success('Backtest completed successfully!');
      setActiveTab('results');
    };

    const handleBacktestFailed = (data: any) => {
      setBacktestJobs(prev => prev.map(job => 
        job.id === data.jobId 
          ? { 
              ...job, 
              status: 'failed', 
              error: data.error,
              completedAt: new Date().toISOString()
            }
          : job
      ));
      
      toast.error('Backtest failed: ' + data.error);
    };

    socket.on('backtest_progress', handleBacktestProgress);
    socket.on('backtest_completed', handleBacktestCompleted);
    socket.on('backtest_failed', handleBacktestFailed);

    return () => {
      socket.off('backtest_progress', handleBacktestProgress);
      socket.off('backtest_completed', handleBacktestCompleted);
      socket.off('backtest_failed', handleBacktestFailed);
    };
  }, [socket]);

  const loadStrategies = async () => {
    try {
      const response = await fetch('/api/strategies');
      const strategies = await response.json();
      if (strategies.length > 0) {
        setCurrentStrategy(strategies[0]);
      }
    } catch (error) {
      console.error('Failed to load strategies:', error);
    }
  };

  const loadBacktestJobs = async () => {
    try {
      const response = await fetch('/api/backtest-jobs');
      const jobs = await response.json();
      setBacktestJobs(jobs);
    } catch (error) {
      console.error('Failed to load backtest jobs:', error);
    }
  };

  const handleSaveStrategy = async (code: string, metadata: any) => {
    try {
      setIsLoading(true);
      
      const strategyData = {
        ...metadata,
        code,
        userId: user?.id
      };

      const response = await fetch('/api/strategies', {
        method: currentStrategy ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...strategyData,
          id: currentStrategy?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save strategy');
      }

      const savedStrategy = await response.json();
      setCurrentStrategy(savedStrategy);
      toast.success('Strategy saved successfully');
    } catch (error) {
      toast.error('Failed to save strategy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunBacktest = async (code: string, config: any) => {
    if (!currentStrategy) {
      toast.error('Please save your strategy first');
      return;
    }

    try {
      setIsLoading(true);
      
      const backtestData = {
        strategyId: currentStrategy.id,
        name: `${currentStrategy.name} - ${new Date().toLocaleString()}`,
        config: {
          ...config,
          strategyCode: code
        },
        userId: user?.id
      };

      const response = await fetch('/api/backtest-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backtestData),
      });

      if (!response.ok) {
        throw new Error('Failed to start backtest');
      }

      const job = await response.json();
      setBacktestJobs(prev => [job, ...prev]);
      setSelectedJob(job);
      setActiveTab('results');
      
      toast.success('Backtest started successfully');
    } catch (error) {
      toast.error('Failed to start backtest');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCode = async (code: string) => {
    try {
      const response = await fetch('/api/validate-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, language: currentStrategy?.language || 'python' }),
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Validation error:', error);
      return { isValid: false, errors: [{ line: 1, column: 1, message: 'Validation failed', severity: 'error' }], warnings: [] };
    }
  };

  const handleExportResults = async (format: 'pdf' | 'csv' | 'json') => {
    if (!selectedJob) return;

    try {
      const response = await fetch(`/api/backtest-jobs/${selectedJob.id}/export?format=${format}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backtest-results.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Results exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export results');
    }
  };

  const handleShareResults = async () => {
    if (!selectedJob) return;

    try {
      const response = await fetch(`/api/backtest-jobs/${selectedJob.id}/share`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const { shareUrl } = await response.json();
      
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
    } catch (error) {
      toast.error('Failed to create share link');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-muted-foreground mb-4">
              Please sign in to access the backtesting platform.
            </p>
            <Button onClick={() => router.push('/auth/signin')}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">Backtesting Platform</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/strategies')}
          >
            <Code className="h-4 w-4 mr-2" />
            My Strategies
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r bg-muted/50 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-2">Recent Backtests</h3>
            <div className="space-y-2">
              {backtestJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedJob?.id === job.id ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
                  }`}
                  onClick={() => {
                    setSelectedJob(job);
                    setActiveTab('results');
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{job.name}</span>
                    {getStatusIcon(job.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  {job.status === 'running' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1">
                        <div 
                          className="bg-primary h-1 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4">
            <h3 className="font-semibold mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab('editor')}
              >
                <Code className="h-4 w-4 mr-2" />
                New Strategy
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => router.push('/strategies')}
              >
                <History className="h-4 w-4 mr-2" />
                Strategy Library
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => router.push('/marketplace')}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Marketplace
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="editor">Strategy Editor</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="editor" className="flex-1 mt-0">
              <StrategyEditor
                strategyId={currentStrategy?.id}
                initialCode={currentStrategy?.code || ''}
                onSave={handleSaveStrategy}
                onRun={handleRunBacktest}
                onValidate={handleValidateCode}
                showTemplates={true}
              />
            </TabsContent>
            
            <TabsContent value="results" className="flex-1 mt-0">
              {selectedJob ? (
                <BacktestResultsDashboard
                  results={{
                    id: selectedJob.id,
                    name: selectedJob.name,
                    status: selectedJob.status as any,
                    progress: selectedJob.progress,
                    startDate: selectedJob.startedAt || selectedJob.createdAt,
                    endDate: selectedJob.completedAt || new Date().toISOString(),
                    duration: selectedJob.duration || 0,
                    metrics: {} as any, // This would be loaded from the API
                    trades: [],
                    portfolioSnapshots: [],
                    benchmarkData: [],
                    logs: [],
                    error: selectedJob.error
                  }}
                  onExport={handleExportResults}
                  onShare={handleShareResults}
                  showActions={true}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Card className="w-96">
                    <CardContent className="p-6 text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No Backtest Selected</h3>
                      <p className="text-muted-foreground mb-4">
                        Select a backtest from the sidebar or run a new one to view results.
                      </p>
                      <Button onClick={() => setActiveTab('editor')}>
                        <Play className="h-4 w-4 mr-2" />
                        Run New Backtest
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="flex-1 mt-0 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Backtest History</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadBacktestJobs}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {backtestJobs.map((job) => (
                    <Card
                      key={job.id}
                      className={`cursor-pointer transition-colors ${
                        selectedJob?.id === job.id ? 'ring-2 ring-primary' : 'hover:bg-accent'
                      }`}
                      onClick={() => {
                        setSelectedJob(job);
                        setActiveTab('results');
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{job.name}</h4>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <span>{new Date(job.createdAt).toLocaleString()}</span>
                              {job.duration && (
                                <span>{Math.round(job.duration / 60)}m {Math.round(job.duration % 60)}s</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(job.status)}
                            <Badge className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default BacktestingPage;
