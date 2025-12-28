/**
 * Smart Python Code Editor Component
 * Tries Monaco Editor first, falls back to textarea if Monaco fails
 */

import React, { useState, useEffect } from 'react';
import { SimplePythonEditor } from './SimplePythonEditor';
import { FallbackPythonEditor } from './FallbackPythonEditor';

interface SmartPythonEditorProps {
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

export function SmartPythonEditor(props: SmartPythonEditorProps) {
  const [useMonaco, setUseMonaco] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Check if Monaco Editor is available
    const checkMonaco = () => {
      if ((window as any).monaco) {
        if (isMounted) {
          setUseMonaco(true);
          setIsLoading(false);
        }
        return;
      }

      // Try to load Monaco Editor
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
      script.onload = () => {
        if (!isMounted) return;
        
        (window as any).require.config({ 
          paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
        });
        (window as any).require(['vs/editor/editor.main'], () => {
          if (isMounted) {
            setUseMonaco(true);
            setIsLoading(false);
          }
        });
      };
      script.onerror = () => {
        console.warn('Monaco Editor failed to load, using fallback editor');
        if (isMounted) {
          setUseMonaco(false);
          setIsLoading(false);
        }
      };
      document.head.appendChild(script);
    };

    checkMonaco();
    
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        <span className="ml-2 text-gray-600">Loading editor...</span>
      </div>
    );
  }

  if (useMonaco) {
    return <SimplePythonEditor {...props} />;
  }

  return <FallbackPythonEditor {...props} />;
}
