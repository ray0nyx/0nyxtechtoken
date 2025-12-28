/**
 * Custom type definitions for d3-scale and d3-shape
 * These are simplified definitions to avoid TypeScript errors
 */

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