/**
 * Institutional Backtester Page
 * Advanced backtesting interface for Pro plan users with celeste theme
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { withInstitutionalAccess } from '@/middleware/institutionalAccess';
import { InstitutionalHeader } from '@/components/institutional/InstitutionalHeader';
import { StrategyBuilder } from '@/components/institutional/StrategyBuilder';
import { BacktestResults } from '@/components/institutional/BacktestResults';
import { ExchangeLinking } from '@/components/institutional/ExchangeLinking';
import { CopyTradingControls } from '@/components/institutional/CopyTradingControls';
import { RiskManagement } from '@/components/institutional/RiskManagement';
import { InstitutionalSidebar } from '@/components/institutional/InstitutionalSidebar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';

interface BacktestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  results?: {
    total_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    trades: any[];
  };
}

interface ExchangeConnection {
  id: string;
  exchange_name: string;
  is_active: boolean;
  last_sync_at: string;
}

function InstitutionalBacktester() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [activeTab, setActiveTab] = useState('strategy');
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBacktest, setSelectedBacktest] = useState<string | null>(null);
  
  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);
  
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load backtests and exchanges in parallel
      const [backtestsData, exchangesData] = await Promise.all([
        loadBacktests(),
        loadExchanges()
      ]);
      
      setBacktests(backtestsData);
      setExchanges(exchangesData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadBacktests = async (): Promise<BacktestResult[]> => {
    try {
      const response = await fetch('/api/institutional/backtests');
      if (!response.ok) throw new Error('Failed to load backtests');
      return await response.json();
    } catch (error) {
      console.error('Error loading backtests:', error);
      return [];
    }
  };
  
  const loadExchanges = async (): Promise<ExchangeConnection[]> => {
    try {
      const response = await fetch('/api/institutional/exchanges');
      if (!response.ok) throw new Error('Failed to load exchanges');
      return await response.json();
    } catch (error) {
      console.error('Error loading exchanges:', error);
      return [];
    }
  };
  
  const handleBacktestCreated = (newBacktest: BacktestResult) => {
    setBacktests(prev => [newBacktest, ...prev]);
    setSelectedBacktest(newBacktest.id);
    setActiveTab('results');
    
    toast({
      title: 'Backtest Started',
      description: `Backtest "${newBacktest.name}" has been queued for execution.`,
    });
  };
  
  const handleExchangeLinked = (newExchange: ExchangeConnection) => {
    setExchanges(prev => [...prev, newExchange]);
    
    toast({
      title: 'Exchange Linked',
      description: `Successfully connected to ${newExchange.exchange_name}.`,
    });
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <InstitutionalHeader />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'strategy', label: 'Strategy Builder', icon: '🧠' },
                    { id: 'results', label: 'Backtest Results', icon: '📊' },
                    { id: 'exchanges', label: 'Exchange Linking', icon: '🔗' },
                    { id: 'copy-trading', label: 'Copy Trading', icon: '📈' },
                    { id: 'risk', label: 'Risk Management', icon: '🛡️' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-cyan-400 text-cyan-600 dark:text-cyan-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'strategy' && (
                  <StrategyBuilder onBacktestCreated={handleBacktestCreated} />
                )}
                
                {activeTab === 'results' && (
                  <BacktestResults 
                    backtests={backtests}
                    selectedBacktest={selectedBacktest}
                    onSelectBacktest={setSelectedBacktest}
                    onRefresh={loadBacktests}
                  />
                )}
                
                {activeTab === 'exchanges' && (
                  <ExchangeLinking 
                    exchanges={exchanges}
                    onExchangeLinked={handleExchangeLinked}
                    onRefresh={loadExchanges}
                  />
                )}
                
                {activeTab === 'copy-trading' && (
                  <CopyTradingControls 
                    backtests={backtests}
                    exchanges={exchanges}
                    selectedBacktest={selectedBacktest}
                  />
                )}
                
                {activeTab === 'risk' && (
                  <RiskManagement exchanges={exchanges} />
                )}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <InstitutionalSidebar 
              backtests={backtests}
              exchanges={exchanges}
              onSelectBacktest={setSelectedBacktest}
              onTabChange={setActiveTab}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with institutional access protection
export default withInstitutionalAccess(InstitutionalBacktester, {
  requireProPlan: true,
  redirectTo: '/pricing'
});
