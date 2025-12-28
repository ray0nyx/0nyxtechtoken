// This file is used to compile the WinLossChart.tsx file with the necessary type declarations

// D3 Scale
declare module 'd3-scale' {
  export interface ScaleLinear<Range = number> {
    (value: number): Range;
    domain(domain: number[]): this;
    range(range: Range[]): this;
  }
  export function scaleLinear<Range = number>(): ScaleLinear<Range>;
}

// D3 Shape
declare module 'd3-shape' {
  export interface Pie<Datum> {
    (data: Datum[]): Array<{
      data: Datum;
      value: number;
      index: number;
      startAngle: number;
      endAngle: number;
      padAngle: number;
    }>;
    value(): (d: Datum, i: number) => number;
    value(value: (d: Datum, i: number) => number): this;
  }
  export function pie<Datum>(): Pie<Datum>;
}

// Import the WinLossChart component to check if it compiles
import './WinLossChart'; 