import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Play } from 'lucide-react';
import { quantBacktesterService } from '@/lib/services/quantBacktesterService';

const DEFAULT_CODE = `# Quant Trading Algorithm Template
# Write your trading strategy here

def initialize(context):
    """Initialize the algorithm"""
    pass

def handle_data(context, data):
    """Main trading logic"""
    # Your trading logic here
    pass
`;

export default function AlgorithmEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<'Python' | 'C#'>('Python');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && id) {
      const loadAlgorithm = async () => {
        setIsLoading(true);
        try {
          const algorithms = await quantBacktesterService.getAlgorithms();
          const algorithm = algorithms.find(a => a.id === id);
          if (algorithm) {
            setName(algorithm.name);
            setDescription(algorithm.description || '');
            setLanguage(algorithm.language);
            setCode(algorithm.code || DEFAULT_CODE);
          }
        } catch (error) {
          console.error('Error loading algorithm:', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadAlgorithm();
    }
  }, [id, isNew]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter an algorithm name');
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Implement save to Supabase
      // For now, just navigate back
      console.log('Saving algorithm:', { name, description, language, code });
      navigate('/app/quant/algorithms');
    } catch (error) {
      console.error('Error saving algorithm:', error);
      alert('Failed to save algorithm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = () => {
    // Navigate to backtest page with algorithm code
    navigate(`/app/quant/backtests?algorithm=${id || 'new'}&code=${encodeURIComponent(code)}`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-[#9ca3af]">Loading algorithm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/quant/algorithms')}
            className="text-[#9ca3af] hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {isNew ? 'New Algorithm' : 'Edit Algorithm'}
            </h1>
            <p className="text-[#9ca3af] mt-1">
              {isNew ? 'Create a new trading algorithm' : 'Edit your trading algorithm'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleRun}
            className="border-[#1f2937] text-[#9ca3af] hover:text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Backtest
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Algorithm Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Algorithm Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-[#1a1f2e] border-[#1f2937]">
            <CardHeader>
              <CardTitle className="text-white">Algorithm Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-[#9ca3af]">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Algorithm name"
                  className="bg-[#0f1419] border-[#1f2937] text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="language" className="text-[#9ca3af]">Language</Label>
                <Select value={language} onValueChange={(v: 'Python' | 'C#') => setLanguage(v)}>
                  <SelectTrigger className="bg-[#0f1419] border-[#1f2937] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-[#1f2937]">
                    <SelectItem value="Python">Python</SelectItem>
                    <SelectItem value="C#">C#</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description" className="text-[#9ca3af]">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Algorithm description"
                  className="bg-[#0f1419] border-[#1f2937] text-white mt-1 min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="lg:col-span-2">
          <Card className="bg-[#1a1f2e] border-[#1f2937] h-full">
            <CardHeader>
              <CardTitle className="text-white">Code Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter your algorithm code here..."
                className="bg-[#0f1419] border-[#1f2937] text-white font-mono min-h-[600px] resize-none"
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

