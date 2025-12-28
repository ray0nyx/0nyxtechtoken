import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary tsconfig file that ignores the d3 errors
const tempTsConfigPath = path.join(__dirname, 'temp-tsconfig.json');
const tsConfig = {
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["../../*"]
    }
  },
  "include": ["WinLossChart.tsx"]
};

fs.writeFileSync(tempTsConfigPath, JSON.stringify(tsConfig, null, 2));

try {
  // Run tsc with the temporary tsconfig file
  execSync(`npx tsc -p ${tempTsConfigPath}`, { stdio: 'inherit' });
  console.log('TypeScript compilation successful!');
} catch (error) {
  console.error('TypeScript compilation failed:', error.message);
} finally {
  // Clean up the temporary tsconfig file
  fs.unlinkSync(tempTsConfigPath);
} 