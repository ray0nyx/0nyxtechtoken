/**
 * Python Code Compilation Service
 * Compiles and validates Python strategy code for backtesting
 */

export interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  ast?: any;
  bytecode?: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

class PythonCompilerService {
  private worker: Worker | null = null;
  private isWorkerReady = false;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    // Create a Web Worker for Python compilation
    const workerCode = `
      // Python compilation worker
      self.onmessage = function(e) {
        const { type, code, id } = e.data;
        
        try {
          switch (type) {
            case 'compile':
              const result = compilePythonCode(code);
              self.postMessage({ id, result });
              break;
            case 'validate':
              const validation = validatePythonCode(code);
              self.postMessage({ id, result: validation });
              break;
            default:
              self.postMessage({ id, error: 'Unknown message type' });
          }
        } catch (error) {
          self.postMessage({ id, error: error.message });
        }
      };

      function compilePythonCode(code) {
        const errors = [];
        const warnings = [];
        
        // Basic Python syntax validation
        const lines = code.split('\\n');
        
        // Check for common Python syntax issues
        let indentLevel = 0;
        let inString = false;
        let stringChar = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          // Skip empty lines and comments
          if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
          }
          
          // Check for string literals
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (!inString && (char === '"' || char === "'")) {
              inString = true;
              stringChar = char;
            } else if (inString && char === stringChar && line[j-1] !== '\\\\') {
              inString = false;
              stringChar = '';
            }
          }
          
          // Check indentation
          const currentIndent = line.length - line.trimStart().length;
          if (currentIndent !== indentLevel * 4) {
            // Check if this is a new block
            if (trimmedLine.endsWith(':')) {
              indentLevel = Math.floor(currentIndent / 4);
            } else if (currentIndent < indentLevel * 4) {
              indentLevel = Math.floor(currentIndent / 4);
            } else if (currentIndent > indentLevel * 4) {
              errors.push(\`Line \${i + 1}: Unexpected indentation\`);
            }
          }
          
          // Check for common syntax errors
          if (trimmedLine.includes('=') && !trimmedLine.includes('==') && !trimmedLine.includes('!=')) {
            // Assignment statement
            if (trimmedLine.includes(' = ') && trimmedLine.split(' = ').length > 2) {
              errors.push(\`Line \${i + 1}: Multiple assignment not allowed\`);
            }
          }
          
          // Check for missing colons
          if (trimmedLine.match(/^(if|elif|else|for|while|def|class|try|except|finally|with)\\s/)) {
            if (!trimmedLine.endsWith(':')) {
              errors.push(\`Line \${i + 1}: Missing colon after \${trimmedLine.split(' ')[0]}\`);
            }
          }
          
          // Check for undefined variables (basic check)
          if (trimmedLine.includes('self.') && !code.includes('class ')) {
            warnings.push(\`Line \${i + 1}: 'self' used outside of class context\`);
          }
        }
        
        // Check for required backtesting functions
        const requiredFunctions = ['Initialize', 'OnData'];
        const hasInitialize = code.includes('def Initialize(');
        const hasOnData = code.includes('def OnData(');
        
        if (!hasInitialize) {
          errors.push('Missing required function: Initialize()');
        }
        if (!hasOnData) {
          errors.push('Missing required function: OnData()');
        }
        
        // Check for required imports
        if (!code.includes('from AlgorithmImports import')) {
          warnings.push('Consider importing AlgorithmImports for backtesting framework');
        }
        
        return {
          success: errors.length === 0,
          errors,
          warnings,
          ast: null, // Would need a proper Python parser
          bytecode: null
        };
      }
      
      function validatePythonCode(code) {
        const errors = [];
        const warnings = [];
        
        // Check for basic Python syntax
        const lines = code.split('\\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          // Check for common issues
          if (trimmedLine.includes('print(') && !trimmedLine.includes('self.Log(')) {
            warnings.push(\`Line \${i + 1}: Consider using self.Log() instead of print() for backtesting\`);
          }
          
          if (trimmedLine.includes('input(')) {
            errors.push(\`Line \${i + 1}: input() function not allowed in backtesting\`);
          }
          
          if (trimmedLine.includes('time.sleep(')) {
            errors.push(\`Line \${i + 1}: time.sleep() not allowed in backtesting\`);
          }
        }
        
        return {
          success: errors.length === 0,
          errors,
          warnings
        };
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    
    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      if (error) {
        console.error('Worker error:', error);
      }
    };
    
    this.isWorkerReady = true;
  }

  async compileCode(code: string): Promise<CompilationResult> {
    if (!this.worker || !this.isWorkerReady) {
      return {
        success: false,
        errors: ['Compiler not ready'],
        warnings: []
      };
    }

    return new Promise((resolve) => {
      const id = Date.now().toString();
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(e.data.result);
        }
      };
      
      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ type: 'compile', code, id });
    });
  }

  async validateCode(code: string): Promise<CompilationResult> {
    if (!this.worker || !this.isWorkerReady) {
      return {
        success: false,
        errors: ['Validator not ready'],
        warnings: []
      };
    }

    return new Promise((resolve) => {
      const id = Date.now().toString();
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(e.data.result);
        }
      };
      
      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ type: 'validate', code, id });
    });
  }

  async executeCode(code: string): Promise<ExecutionResult> {
    // This would integrate with the Python backend for actual execution
    // For now, we'll simulate execution
    const startTime = Date.now();
    
    try {
      // Simulate code execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        output: 'Strategy executed successfully',
        error: '',
        executionTime
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  // Generate strategy template
  generateTemplate(): string {
    return `# 0nyx Strategy Template
from AlgorithmImports import *
import numpy as np
import pandas as pd

class 0nyxStrategy(QCAlgorithm):
    def Initialize(self):
        # Set start and end dates
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 12, 31)
        
        # Set initial cash
        self.SetCash(100000)
        
        # Add symbols
        self.AddCrypto("BTCUSD", Resolution.Hour)
        self.AddCrypto("ETHUSD", Resolution.Hour)
        
        # Set benchmark
        self.SetBenchmark("BTCUSD")
        
        # Initialize strategy variables
        self.lookback = 20
        self.threshold = 0.02
        
        # Schedule rebalancing
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(9, 0),
            self.Rebalance
        )
    
    def Rebalance(self):
        """Main rebalancing logic"""
        if self.IsWarmUp:
            return
        
        # Get historical data
        history = self.History(self.Securities.Keys, self.lookback, Resolution.Hour)
        
        if history.empty:
            return
        
        # Calculate momentum for each symbol
        for symbol in self.Securities.Keys:
            symbol_data = history.loc[symbol]
            if len(symbol_data) < self.lookback:
                continue
            
            # Calculate momentum
            returns = symbol_data['close'].pct_change().dropna()
            momentum = returns.mean() * 252  # Annualized
            
            # Trading logic
            if momentum > self.threshold:
                self.SetHoldings(symbol, 0.5)
            elif momentum < -self.threshold:
                self.SetHoldings(symbol, -0.5)
            else:
                self.SetHoldings(symbol, 0)
    
    def OnData(self, data):
        """Handle incoming data"""
        # Add your real-time data handling logic here
        pass`;
  }

  // Cleanup
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const pythonCompiler = new PythonCompilerService();
