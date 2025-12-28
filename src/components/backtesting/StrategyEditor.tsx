/**
 * QuantConnect-style Strategy Editor Component
 * Monaco Editor with IntelliSense, templates, and real-time validation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  Settings, 
  Code, 
  FileText, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Copy,
  Share2,
  History
} from 'lucide-react';
import { toast } from 'sonner';

interface StrategyEditorProps {
  strategyId?: string;
  initialCode?: string;
  onSave?: (code: string, metadata: StrategyMetadata) => void;
  onRun?: (code: string, config: BacktestConfig) => void;
  onValidate?: (code: string) => ValidationResult;
  readOnly?: boolean;
  showTemplates?: boolean;
}

interface StrategyMetadata {
  name: string;
  description: string;
  language: 'python' | 'csharp';
  category: string;
  tags: string[];
  parameters: Record<string, any>;
}

interface BacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  timeframe: string;
  dataSource: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  suggestion?: string;
}

interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  language: 'python' | 'csharp';
  tags: string[];
}

const PYTHON_TEMPLATES: CodeTemplate[] = [
  {
    id: 'basic_template',
    name: 'Basic Template',
    description: 'A simple moving average crossover strategy',
    category: 'Trend Following',
    language: 'python',
    tags: ['moving-average', 'crossover', 'trend'],
    code: `from AlgorithmImports import *

class BasicTemplateAlgorithm(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2021, 1, 1)
        self.SetCash(100000)
        
        # Add equity data
        self.symbol = self.AddEquity("SPY", Resolution.Daily).Symbol
        
        # Create moving averages
        self.fast_ma = self.SMA(self.symbol, 10, Resolution.Daily)
        self.slow_ma = self.SMA(self.symbol, 20, Resolution.Daily)
        
        # Set up indicators
        self.SetWarmUp(20)
    
    def OnData(self, data):
        if self.IsWarmingUp:
            return
            
        if not self.fast_ma.IsReady or not self.slow_ma.IsReady:
            return
        
        # Buy signal: fast MA crosses above slow MA
        if self.fast_ma.Current.Value > self.slow_ma.Current.Value:
            if not self.Portfolio[self.symbol].Invested:
                self.SetHoldings(self.symbol, 1.0)
        
        # Sell signal: fast MA crosses below slow MA
        elif self.fast_ma.Current.Value < self.slow_ma.Current.Value:
            if self.Portfolio[self.symbol].Invested:
                self.Liquidate(self.symbol)`
  },
  {
    id: 'rsi_strategy',
    name: 'RSI Strategy',
    description: 'RSI-based mean reversion strategy',
    category: 'Mean Reversion',
    language: 'python',
    tags: ['rsi', 'mean-reversion', 'oscillator'],
    code: `from AlgorithmImports import *

class RSIStrategy(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2021, 1, 1)
        self.SetCash(100000)
        
        # Add equity data
        self.symbol = self.AddEquity("SPY", Resolution.Daily).Symbol
        
        # Create RSI indicator
        self.rsi = self.RSI(self.symbol, 14, Resolution.Daily)
        
        # Set up indicators
        self.SetWarmUp(14)
    
    def OnData(self, data):
        if self.IsWarmingUp:
            return
            
        if not self.rsi.IsReady:
            return
        
        rsi_value = self.rsi.Current.Value
        
        # Buy signal: RSI oversold
        if rsi_value < 30 and not self.Portfolio[self.symbol].Invested:
            self.SetHoldings(self.symbol, 1.0)
        
        # Sell signal: RSI overbought
        elif rsi_value > 70 and self.Portfolio[self.symbol].Invested:
            self.Liquidate(self.symbol)`
  },
  {
    id: 'bollinger_bands',
    name: 'Bollinger Bands',
    description: 'Bollinger Bands mean reversion strategy',
    category: 'Mean Reversion',
    language: 'python',
    tags: ['bollinger-bands', 'mean-reversion', 'volatility'],
    code: `from AlgorithmImports import *

class BollingerBandsStrategy(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2021, 1, 1)
        self.SetCash(100000)
        
        # Add equity data
        self.symbol = self.AddEquity("SPY", Resolution.Daily).Symbol
        
        # Create Bollinger Bands
        self.bb = self.BB(self.symbol, 20, 2, Resolution.Daily)
        
        # Set up indicators
        self.SetWarmUp(20)
    
    def OnData(self, data):
        if self.IsWarmingUp:
            return
            
        if not self.bb.IsReady:
            return
        
        price = data[self.symbol].Price
        upper_band = self.bb.UpperBand.Current.Value
        lower_band = self.bb.LowerBand.Current.Value
        middle_band = self.bb.MiddleBand.Current.Value
        
        # Buy signal: price touches lower band
        if price <= lower_band and not self.Portfolio[self.symbol].Invested:
            self.SetHoldings(self.symbol, 1.0)
        
        # Sell signal: price touches upper band
        elif price >= upper_band and self.Portfolio[self.symbol].Invested:
            self.Liquidate(self.symbol)`
  }
];

const CSHARP_TEMPLATES: CodeTemplate[] = [
  {
    id: 'basic_template_csharp',
    name: 'Basic Template (C#)',
    description: 'A simple moving average crossover strategy in C#',
    category: 'Trend Following',
    language: 'csharp',
    tags: ['moving-average', 'crossover', 'trend'],
    code: `using System;
using QuantConnect.Algorithm;
using QuantConnect.Indicators;

namespace QuantConnect.Algorithm.CSharp
{
    public class BasicTemplateAlgorithm : QCAlgorithm
    {
        private Symbol _symbol;
        private SimpleMovingAverage _fastMa;
        private SimpleMovingAverage _slowMa;
        
        public override void Initialize()
        {
            SetStartDate(2020, 1, 1);
            SetEndDate(2021, 1, 1);
            SetCash(100000);
            
            // Add equity data
            _symbol = AddEquity("SPY", Resolution.Daily).Symbol;
            
            // Create moving averages
            _fastMa = SMA(_symbol, 10, Resolution.Daily);
            _slowMa = SMA(_symbol, 20, Resolution.Daily);
            
            // Set up indicators
            SetWarmUp(20);
        }
        
        public override void OnData(Slice data)
        {
            if (IsWarmingUp) return;
            
            if (!_fastMa.IsReady || !_slowMa.IsReady) return;
            
            // Buy signal: fast MA crosses above slow MA
            if (_fastMa.Current.Value > _slowMa.Current.Value)
            {
                if (!Portfolio[_symbol].Invested)
                {
                    SetHoldings(_symbol, 1.0);
                }
            }
            // Sell signal: fast MA crosses below slow MA
            else if (_fastMa.Current.Value < _slowMa.Current.Value)
            {
                if (Portfolio[_symbol].Invested)
                {
                    Liquidate(_symbol);
                }
            }
        }
    }
}`
  }
];

export const StrategyEditor: React.FC<StrategyEditorProps> = ({
  strategyId,
  initialCode = '',
  onSave,
  onRun,
  onValidate,
  readOnly = false,
  showTemplates = true
}) => {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState<'python' | 'csharp'>('python');
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [isValidating, setIsValidating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [strategyMetadata, setStrategyMetadata] = useState<StrategyMetadata>({
    name: '',
    description: '',
    language: 'python',
    category: 'Custom',
    tags: [],
    parameters: {}
  });

  const editorRef = useRef<any>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout>();

  // Load strategy if strategyId is provided
  useEffect(() => {
    if (strategyId) {
      loadStrategy(strategyId);
    }
  }, [strategyId]);

  // Validate code on change
  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      validateCode();
    }, 1000);

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [code]);

  const loadStrategy = async (id: string) => {
    try {
      // This would fetch strategy from API
      const response = await fetch(`/api/strategies/${id}`);
      const strategy = await response.json();
      
      setCode(strategy.code);
      setLanguage(strategy.language);
      setStrategyMetadata({
        name: strategy.name,
        description: strategy.description,
        language: strategy.language,
        category: strategy.category,
        tags: strategy.tags || [],
        parameters: strategy.parameters || {}
      });
    } catch (error) {
      toast.error('Failed to load strategy');
    }
  };

  const validateCode = async () => {
    if (!onValidate) return;

    setIsValidating(true);
    try {
      const result = await onValidate(code);
      setValidation(result);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;

    try {
      await onSave(code, strategyMetadata);
      toast.success('Strategy saved successfully');
    } catch (error) {
      toast.error('Failed to save strategy');
    }
  };

  const handleRun = async () => {
    if (!onRun) return;

    setIsRunning(true);
    try {
      const config: BacktestConfig = {
        symbols: ['SPY'],
        startDate: '2020-01-01',
        endDate: '2021-01-01',
        initialCapital: 100000,
        timeframe: '1d',
        dataSource: 'yahoo'
      };

      await onRun(code, config);
      toast.success('Backtest started');
    } catch (error) {
      toast.error('Failed to start backtest');
    } finally {
      setIsRunning(false);
    }
  };

  const handleTemplateSelect = (template: CodeTemplate) => {
    setCode(template.code);
    setLanguage(template.language);
    setStrategyMetadata(prev => ({
      ...prev,
      language: template.language,
      category: template.category,
      tags: template.tags
    }));
    setShowTemplatesPanel(false);
    toast.success(`Loaded ${template.name} template`);
  };

  const handleLanguageChange = (newLanguage: 'python' | 'csharp') => {
    setLanguage(newLanguage);
    setStrategyMetadata(prev => ({ ...prev, language: newLanguage }));
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
    
    // Configure editor
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto'
      },
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true
    });
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
    
    if (validation.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getValidationMessage = () => {
    if (isValidating) {
      return 'Validating...';
    }
    
    if (validation.isValid) {
      return 'Code is valid';
    }
    
    return `${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold">Strategy Editor</h2>
          <div className="flex items-center space-x-2">
            {getValidationIcon()}
            <span className="text-sm text-muted-foreground">
              {getValidationMessage()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatesPanel(!showTemplatesPanel)}
          >
            <Code className="h-4 w-4 mr-2" />
            Templates
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!validation.isValid}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          
          <Button
            size="sm"
            onClick={handleRun}
            disabled={!validation.isValid || isRunning}
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running...' : 'Run Backtest'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Templates Panel */}
        {showTemplatesPanel && (
          <div className="w-80 border-r bg-muted/50 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Templates</h3>
                <div className="flex space-x-2">
                  <Button
                    variant={language === 'python' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLanguageChange('python')}
                  >
                    Python
                  </Button>
                  <Button
                    variant={language === 'csharp' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLanguageChange('csharp')}
                  >
                    C#
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                {(language === 'python' ? PYTHON_TEMPLATES : CSHARP_TEMPLATES).map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>
            
            <TabsContent value="editor" className="flex-1 mt-0">
              <div className="h-full">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  onMount={handleEditorMount}
                  options={{
                    readOnly,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    wordWrap: 'on',
                    folding: true,
                    lineDecorationsWidth: 10,
                    lineNumbersMinChars: 3,
                    renderLineHighlight: 'line',
                    scrollbar: {
                      vertical: 'auto',
                      horizontal: 'auto'
                    }
                  }}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="validation" className="flex-1 mt-0 p-4">
              <div className="space-y-4">
                {validation.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-600 mb-2">Errors</h4>
                    <div className="space-y-2">
                      {validation.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            Line {error.line}: {error.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
                
                {validation.warnings.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-yellow-600 mb-2">Warnings</h4>
                    <div className="space-y-2">
                      {validation.warnings.map((warning, index) => (
                        <Alert key={index} variant="default">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Line {warning.line}: {warning.message}
                            {warning.suggestion && (
                              <div className="mt-1 text-sm text-muted-foreground">
                                Suggestion: {warning.suggestion}
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
                
                {validation.isValid && !isValidating && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No errors or warnings found. Your code is ready to run!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="metadata" className="flex-1 mt-0 p-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Strategy Name</label>
                  <input
                    type="text"
                    value={strategyMetadata.name}
                    onChange={(e) => setStrategyMetadata(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Enter strategy name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={strategyMetadata.description}
                    onChange={(e) => setStrategyMetadata(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    rows={3}
                    placeholder="Enter strategy description"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={strategyMetadata.category}
                    onChange={(e) => setStrategyMetadata(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    <option value="Custom">Custom</option>
                    <option value="Trend Following">Trend Following</option>
                    <option value="Mean Reversion">Mean Reversion</option>
                    <option value="Momentum">Momentum</option>
                    <option value="Arbitrage">Arbitrage</option>
                    <option value="Market Making">Market Making</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Tags</label>
                  <input
                    type="text"
                    value={strategyMetadata.tags.join(', ')}
                    onChange={(e) => setStrategyMetadata(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Enter tags separated by commas"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StrategyEditor;
