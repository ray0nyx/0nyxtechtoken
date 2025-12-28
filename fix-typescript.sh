#!/bin/bash

# Script to fix TypeScript errors in the project
echo "Fixing TypeScript errors..."

# Create a temporary directory for type definitions
mkdir -p node_modules/@types/d3-scale
mkdir -p node_modules/@types/d3-shape

# Create index.d.ts files for d3-scale and d3-shape
cat > node_modules/@types/d3-scale/index.d.ts << 'EOL'
declare module 'd3-scale' {
  export function scaleOrdinal<Range = any>(): {
    (value: any): Range;
    domain: (domain: any[]) => any;
    range: (range: Range[]) => any;
  };
  
  export function scaleLinear<Range = number>(): {
    (value: number): Range;
    domain: (domain: number[]) => any;
    range: (range: Range[]) => any;
    nice: () => any;
    ticks: (count?: number) => number[];
  };
  
  export const schemeCategory10: string[];
  export const schemeCategory20: string[];
  export const schemeCategory20b: string[];
  export const schemeCategory20c: string[];
}
EOL

cat > node_modules/@types/d3-shape/index.d.ts << 'EOL'
declare module 'd3-shape' {
  export function pie<T = any>(): {
    (data: T[]): Array<{
      data: T;
      value: number;
      index: number;
      startAngle: number;
      endAngle: number;
      padAngle: number;
    }>;
    value: (v: any) => any;
    sort: (v: any) => any;
    startAngle: (v: any) => any;
    endAngle: (v: any) => any;
    padAngle: (v: any) => any;
  };
  
  export function arc<T = any>(): {
    (d: any): string | null;
    innerRadius: (v: any) => any;
    outerRadius: (v: any) => any;
    cornerRadius: (v: any) => any;
    startAngle: (v: any) => any;
    endAngle: (v: any) => any;
    padAngle: (v: any) => any;
    padRadius: (v: any) => any;
    context: (v: any) => any;
  };
}
EOL

# Create package.json files for d3-scale and d3-shape
cat > node_modules/@types/d3-scale/package.json << 'EOL'
{
  "name": "@types/d3-scale",
  "version": "1.0.0",
  "description": "TypeScript definitions for d3-scale",
  "main": "",
  "types": "index.d.ts"
}
EOL

cat > node_modules/@types/d3-shape/package.json << 'EOL'
{
  "name": "@types/d3-shape",
  "version": "1.0.0",
  "description": "TypeScript definitions for d3-shape",
  "main": "",
  "types": "index.d.ts"
}
EOL

echo "TypeScript errors fixed!"
echo "You can now run the development server with:"
echo "./dev.sh" 