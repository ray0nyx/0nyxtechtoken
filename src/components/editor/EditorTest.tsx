/**
 * Editor Test Component
 * Simple test to verify the Python editor is working
 */

import React, { useState } from 'react';
import { StablePythonEditor } from './StablePythonEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EditorTest() {
  const [code, setCode] = useState(`# Test Python Code
print("Hello, World!")

def test_function():
    return "This is a test"

class TestClass:
    def __init__(self):
        self.value = 42
`);

  const handleCompile = async (code: string) => {
    console.log('Compiling code:', code);
    return {
      success: true,
      errors: [],
      warnings: []
    };
  };

  const handleRun = async (code: string) => {
    console.log('Running code:', code);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Python Editor Test</CardTitle>
          <p className="text-sm text-gray-600">
            Test the Python code editor functionality
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Button 
                onClick={() => setCode('')}
                variant="outline"
              >
                Clear
              </Button>
              <Button 
                onClick={() => setCode(`# Sample Strategy Code
from AlgorithmImports import *

class MyStrategy(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(100000)
        self.AddCrypto("BTCUSD", Resolution.Hour)
    
    def OnData(self, data):
        pass`)}
                variant="outline"
              >
                Load Sample
              </Button>
            </div>
            
            <StablePythonEditor
              value={code}
              onChange={setCode}
              onCompile={handleCompile}
              onRun={handleRun}
              height="400px"
            />
            
            <div className="text-xs text-gray-500">
              <p>Current code length: {code.length} characters</p>
              <p>Lines: {code.split('\n').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
