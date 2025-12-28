import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FileCode } from 'lucide-react';
import AlgorithmList, { type Algorithm } from '@/components/quant/AlgorithmList';
import { quantBacktesterService } from '@/lib/services/quantBacktesterService';

export default function Algorithms() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [filteredAlgorithms, setFilteredAlgorithms] = useState<Algorithm[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAlgorithms = async () => {
      setIsLoading(true);
      try {
        const data = await quantBacktesterService.getAlgorithms();
        if (data.length > 0) {
          setAlgorithms(data);
          setFilteredAlgorithms(data);
        } else {
          // Fallback to mock data if no algorithms found
          const mockAlgorithms: Algorithm[] = [
            {
              id: '1',
              name: 'Mean Reversion Strategy',
              language: 'Python',
              status: 'Running',
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              description: 'Mean reversion strategy for crypto markets',
            },
            {
              id: '2',
              name: 'Momentum Trading Bot',
              language: 'Python',
              status: 'Stopped',
              createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
              lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              description: 'Momentum-based trading algorithm',
            },
          ];
          setAlgorithms(mockAlgorithms);
          setFilteredAlgorithms(mockAlgorithms);
        }
      } catch (error) {
        console.error('Error loading algorithms:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlgorithms();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAlgorithms(algorithms);
    } else {
      const filtered = algorithms.filter(
        (alg) =>
          alg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          alg.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAlgorithms(filtered);
    }
  }, [searchQuery, algorithms]);

  const handleEdit = (id: string) => {
    // Navigate to code editor with algorithm ID
    navigate(`/app/quant/algorithms/${id}/edit`);
  };

  const handleRun = (id: string) => {
    // Start backtest with this algorithm
    navigate(`/app/quant/backtests?algorithm=${id}`);
  };

  const handleDelete = (id: string) => {
    // Delete algorithm (with confirmation)
    if (window.confirm('Are you sure you want to delete this algorithm?')) {
      setAlgorithms(algorithms.filter((alg) => alg.id !== id));
      // TODO: Call API to delete
    }
  };

  const handleCreateNew = () => {
    navigate('/app/quant/algorithms/new');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Algorithms</h1>
          <p className="text-[#9ca3af] mt-1">Manage your trading algorithms</p>
        </div>
        <Button
          onClick={handleCreateNew}
          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Algorithm
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
        <Input
          type="text"
          placeholder="Search algorithms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#1a1f2e] border-[#1f2937] text-white placeholder:text-[#6b7280]"
        />
      </div>

      {/* Algorithms List */}
      <Card className="bg-[#1a1f2e] border-[#1f2937]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              {filteredAlgorithms.length} Algorithm{filteredAlgorithms.length !== 1 ? 's' : ''}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-[#9ca3af]">Loading algorithms...</p>
            </div>
          ) : filteredAlgorithms.length > 0 ? (
            <AlgorithmList
              algorithms={filteredAlgorithms}
              onEdit={handleEdit}
              onRun={handleRun}
              onDelete={handleDelete}
            />
          ) : (
            <div className="text-center py-12">
              <FileCode className="w-12 h-12 mx-auto text-[#6b7280] mb-4" />
              <p className="text-[#9ca3af] mb-2">No algorithms found</p>
              <p className="text-sm text-[#6b7280] mb-4">
                {searchQuery ? 'Try a different search term' : 'Create your first algorithm to get started'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={handleCreateNew}
                  variant="outline"
                  className="border-[#1f2937] text-[#9ca3af] hover:text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Algorithm
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

