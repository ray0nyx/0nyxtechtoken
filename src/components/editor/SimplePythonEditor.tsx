/**
 * Simple Python Code Editor Component
 * Uses Monaco Editor with minimal configuration for better reliability
 */

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  Code, 
  CheckCircle, 
  XCircle, 
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { strategyExecutor } from '@/lib/services/strategyExecutor';

interface SimplePythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCompile?: (code: string) => Promise<CompilationResult>;
  onRun?: (code: string) => Promise<void>;
  height?: string;
  readOnly?: boolean;
}

interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  ast?: any;
  bytecode?: string;
}

export function SimplePythonEditor({ 
  value, 
  onChange, 
  onCompile, 
  onRun, 
  height = '500px',
  readOnly = false 
}: SimplePythonEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const { toast } = useToast();

  // Load Monaco Editor
  useEffect(() => {
    let isMounted = true;

    const initializeEditor = () => {
      if (!isMounted || !editorRef.current || editorInstanceRef.current) return;
      
      try {
        const monaco = (window as any).monaco;
        if (!monaco) return;
        
        // Create editor with minimal configuration
        const editorInstance = monaco.editor.create(editorRef.current, {
          value: value || '',
          language: 'python',
          theme: 'vs-dark',
          automaticLayout: true,
          readOnly: readOnly,
          fontSize: 14,
          lineNumbers: 'on',
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: true,
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          acceptSuggestionOnEnter: 'on'
        });

        // Store editor instance
        editorInstanceRef.current = editorInstance;

        // Listen for content changes
        editorInstance.onDidChangeModelContent(() => {
          if (isMounted) {
            const newValue = editorInstance.getValue();
            onChange(newValue);
          }
        });

        // Add keyboard shortcuts
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          handleSave();
        });

        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC, () => {
          handleCompile();
        });

        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR, () => {
          handleRun();
        });

        if (isMounted) {
          setIsEditorReady(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to initialize Monaco Editor:', error);
        if (isMounted) {
          setIsLoading(false);
          toast({
            title: 'Editor Error',
            description: 'Failed to load code editor. Please refresh the page.',
            variant: 'destructive'
          });
        }
      }
    };

    const loadMonaco = async () => {
      try {
        // Check if Monaco is already loaded
        if ((window as any).monaco) {
          initializeEditor();
          return;
        }

        // Load Monaco Editor
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
        script.onload = () => {
          if (!isMounted) return;
          
          (window as any).require.config({ 
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
          });
          (window as any).require(['vs/editor/editor.main'], () => {
            if (isMounted) {
              initializeEditor();
            }
          });
        };
        script.onerror = () => {
          console.error('Failed to load Monaco Editor');
          if (isMounted) {
            setIsLoading(false);
          }
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error loading Monaco Editor:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMonaco();

    return () => {
      isMounted = false;
      if (editorInstanceRef.current) {
        editorInstanceRef.current.dispose();
        editorInstanceRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once

  // Update editor value when prop changes
  useEffect(() => {
    if (editorInstanceRef.current && isEditorReady) {
      const currentValue = editorInstanceRef.current.getValue();
      if (currentValue !== value) {
        // Temporarily disable the change listener to prevent loops
        const model = editorInstanceRef.current.getModel();
        if (model) {
          model.setValue(value);
        }
      }
    }
  }, [value, isEditorReady]);

  const handleCompile = async () => {
    if (!editorInstanceRef.current) return;
    
    setIsCompiling(true);
    try {
      const code = editorInstanceRef.current.getValue();
      const result = onCompile ? await onCompile(code) : await strategyExecutor.compileStrategy(code);
      setCompilationResult(result);
      
      if (result.success) {
        toast({
          title: 'Compilation Successful',
          description: 'Python code compiled without errors',
        });
      } else {
        toast({
          title: 'Compilation Failed',
          description: `Found ${result.errors.length} errors`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Compilation error:', error);
      toast({
        title: 'Compilation Error',
        description: 'An error occurred during compilation',
        variant: 'destructive'
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRun = async () => {
    if (!editorInstanceRef.current) return;
    
    setIsRunning(true);
    try {
      const code = editorInstanceRef.current.getValue();
      if (onRun) {
        await onRun(code);
      } else {
        // Default execution using strategy executor
        const result = await strategyExecutor.executeStrategy({
          code,
          symbols: ['BTC/USDT', 'ETH/USDT'],
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          initialCapital: 100000,
          timeframe: '1h',
        });
        
        if (result.success) {
          toast({
            title: 'Strategy Executed',
            description: `Backtest completed with ${result.results?.totalReturn.toFixed(2)}% return`,
          });
        } else {
          toast({
            title: 'Execution Failed',
            description: result.error || 'Strategy execution failed',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
      toast({
        title: 'Execution Error',
        description: 'An error occurred during strategy execution',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = () => {
    if (!editorInstanceRef.current) return;
    
    const code = editorInstanceRef.current.getValue();
    const blob = new Blob([code], { type: 'text/python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategy.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Strategy Saved',
      description: 'Strategy code has been downloaded as strategy.py',
    });
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (editorInstanceRef.current) {
            editorInstanceRef.current.setValue(content);
          }
          onChange(content);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-cyan-600" />
            <span>Python Code Editor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            <span className="ml-2 text-gray-600">Loading editor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-cyan-600" />
            <span>Python Strategy Code</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {compilationResult && (
              <Badge variant={compilationResult.success ? "default" : "destructive"}>
                {compilationResult.success ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                {compilationResult.success ? 'Compiled' : 'Errors'}
              </Badge>
            )}
            <Badge variant="outline">
              Python
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <Button
            size="sm"
            onClick={handleCompile}
            disabled={isCompiling || !isEditorReady}
            className="flex items-center space-x-1"
          >
            {isCompiling ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            <span>Compile</span>
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !isEditorReady}
            className="flex items-center space-x-1"
          >
            {isRunning ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            ) : (
              <Play className="w-3 h-3" />
            )}
            <span>Run</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            className="flex items-center space-x-1"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLoad}
            className="flex items-center space-x-1"
          >
            <Upload className="w-3 h-3" />
            <span>Load</span>
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+S</kbd> Save • 
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs ml-1">Ctrl+Shift+C</kbd> Compile • 
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs ml-1">Ctrl+Shift+R</kbd> Run
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={editorRef} 
          style={{ height, width: '100%' }}
          className="border rounded-md overflow-hidden"
        />
        
        {/* Compilation Results */}
        {compilationResult && !compilationResult.success && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-200">Compilation Errors</span>
            </div>
            <div className="space-y-1">
              {compilationResult.errors.map((error, index) => (
                <div key={index} className="text-sm text-red-700 dark:text-red-300 font-mono">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {compilationResult && compilationResult.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-800 dark:text-yellow-200">Warnings</span>
            </div>
            <div className="space-y-1">
              {compilationResult.warnings.map((warning, index) => (
                <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300 font-mono">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
