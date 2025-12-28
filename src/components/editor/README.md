# Python Code Editor Components

This directory contains Python code editor components for the 0nyx quant testing platform.

## Components

### 1. SmartPythonEditor
**Main component to use** - Automatically chooses the best available editor.

- Tries Monaco Editor first (VSCode-like experience)
- Falls back to textarea if Monaco fails to load
- Provides seamless user experience

### 2. SimplePythonEditor
Monaco Editor implementation with simplified configuration.

- Professional code editing experience
- Python syntax highlighting
- IntelliSense and auto-completion
- Keyboard shortcuts (Ctrl+S, Ctrl+Shift+C, Ctrl+Shift+R)

### 3. FallbackPythonEditor
Simple textarea fallback when Monaco Editor is not available.

- Basic text editing
- Same functionality as Monaco version
- Reliable fallback option

### 4. PythonCodeEditor
Original complex Monaco Editor implementation (deprecated).

- Overly complex configuration
- May have typing issues
- Use SmartPythonEditor instead

## Usage

```tsx
import { SmartPythonEditor } from '@/components/editor/SmartPythonEditor';

function MyComponent() {
  const [code, setCode] = useState('');

  return (
    <SmartPythonEditor
      value={code}
      onChange={setCode}
      onCompile={handleCompile}
      onRun={handleRun}
      height="500px"
    />
  );
}
```

## Features

- **Code Compilation**: Validate Python syntax
- **Strategy Execution**: Run backtesting strategies
- **File Management**: Save and load strategy files
- **Error Reporting**: Real-time error and warning display
- **Keyboard Shortcuts**: Professional editing shortcuts
- **Template Loading**: Load strategy templates

## Testing

Visit `/debug/editor` to test the editor functionality.

## Troubleshooting

If you can't type in the editor:

1. Check browser console for errors
2. Try refreshing the page
3. The editor will automatically fall back to textarea if Monaco fails
4. Visit `/debug/editor` to test the editor

## Keyboard Shortcuts

- `Ctrl+S` - Save strategy
- `Ctrl+Shift+C` - Compile code
- `Ctrl+Shift+R` - Run strategy
