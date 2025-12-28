import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, BarChart3 } from 'lucide-react';
import BacktestResultsTable, { type BacktestResult } from '@/components/quant/BacktestResultsTable';
import { quantBacktesterService } from '@/lib/services/quantBacktesterService';

export default function BacktestAnalysis() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'sharpe' | 'return' | 'drawdown'>('date');
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<BacktestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBacktests = async () => {
      setIsLoading(true);
      try {
        const data = await quantBacktesterService.getBacktests();
        if (data.length > 0) {
          const formattedResults: BacktestResult[] = data.map((bt) => ({
            id: bt.id,
            name: bt.name,
            sharpeRatio: bt.metrics?.sharpeRatio || 0,
            totalReturn: bt.metrics?.totalReturn || 0,
            drawdown: bt.metrics?.maxDrawdown || 0,
            date: bt.startTime || new Date().toISOString(),
            status: bt.status === 'completed' ? 'completed' : bt.status === 'running' ? 'running' : 'failed',
            equityCurve: bt.equityCurve,
          }));
          setResults(formattedResults);
          setFilteredResults(formattedResults);
        } else {
          // Fallback to mock data
          const mockResults: BacktestResult[] = [
            {
              id: '1',
              name: 'Mean Reversion - BTC/USDT',
              sharpeRatio: 2.15,
              totalReturn: 34.5,
              drawdown: -8.2,
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
            },
          ];
          setResults(mockResults);
          setFilteredResults(mockResults);
        }
      } catch (error) {
        console.error('Error loading backtests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBacktests();
  }, []);

  useEffect(() => {
    let filtered = [...results];

    // Apply search filter
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((result) =>
        result.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'sharpe':
          return b.sharpeRatio - a.sharpeRatio;
        case 'return':
          return b.totalReturn - a.totalReturn;
        case 'drawdown':
          return a.drawdown - b.drawdown; // Lower is better
        case 'date':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    setFilteredResults(filtered);
  }, [searchQuery, sortBy, results]);

  const handleViewReport = (id: string) => {
    navigate(`/app/quant/backtests/${id}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Backtest Analysis</h1>
          <p className="text-[#9ca3af] mt-1">Review and compare your backtest results</p>
        </div>
        <Button
          onClick={() => navigate('/app/quant/algorithms')}
          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          New Backtest
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          <Input
            type="text"
            placeholder="Search backtests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1a1f2e] border-[#1f2937] text-white placeholder:text-[#6b7280]"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-48 bg-[#1a1f2e] border-[#1f2937] text-white">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1f2e] border-[#1f2937]">
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="sharpe">Sort by Sharpe</SelectItem>
            <SelectItem value="return">Sort by Return</SelectItem>
            <SelectItem value="drawdown">Sort by Drawdown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Table */}
      <Card className="bg-[#1a1f2e] border-[#1f2937]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              {filteredResults.length} Backtest{filteredResults.length !== 1 ? 's' : ''}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-[#9ca3af]">Loading backtests...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <BacktestResultsTable
              results={filteredResults}
              onViewReport={handleViewReport}
            />
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto text-[#6b7280] mb-4" />
              <p className="text-[#9ca3af] mb-2">No backtests found</p>
              <p className="text-sm text-[#6b7280] mb-4">
                {searchQuery ? 'Try a different search term' : 'Run your first backtest to see results here'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => navigate('/app/quant/algorithms')}
                  variant="outline"
                  className="border-[#1f2937] text-[#9ca3af] hover:text-white"
                >
                  Start Backtest
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

