declare module 'd3-scale' {
  export interface ScaleLinear<Range = number> {
    (value: number): Range;
    domain(domain: number[]): this;
    range(range: Range[]): this;
    nice(): this;
    ticks(count?: number): number[];
  }

  export interface ScaleBand<Range = number> {
    (value: string): Range;
    domain(domain: string[]): this;
    range(range: Range[]): this;
    padding(padding: number): this;
    bandwidth(): number;
  }

  export interface ScaleTime<Range = number> {
    (value: Date): Range;
    domain(domain: Date[]): this;
    range(range: Range[]): this;
    nice(): this;
    ticks(count?: number): Date[];
  }

  export function scaleLinear<Range = number>(): ScaleLinear<Range>;
  export function scaleBand<Range = number>(): ScaleBand<Range>;
  export function scaleTime<Range = number>(): ScaleTime<Range>;
  export function scaleOrdinal(): any;
  export const schemeCategory10: string[];
}

declare module 'd3-shape' {
  export interface Line<Datum> {
    (data: Datum[]): string | null;
    x(): (d: Datum, i: number) => number;
    x(x: (d: Datum, i: number) => number): this;
    y(): (d: Datum, i: number) => number;
    y(y: (d: Datum, i: number) => number): this;
    curve(): any;
    curve(curve: any): this;
  }

  export interface Area<Datum> {
    (data: Datum[]): string | null;
    x(): (d: Datum, i: number) => number;
    x(x: (d: Datum, i: number) => number): this;
    y0(): (d: Datum, i: number) => number;
    y0(y0: (d: Datum, i: number) => number): this;
    y1(): (d: Datum, i: number) => number;
    y1(y1: (d: Datum, i: number) => number): this;
    curve(): any;
    curve(curve: any): this;
  }

  export interface Pie<Datum> {
    (data: Datum[]): Array<{
      data: Datum;
      index: number;
      value: number;
      startAngle: number;
      endAngle: number;
      padAngle: number;
    }>;
    value(): (d: Datum, i: number) => number;
    value(value: (d: Datum, i: number) => number): this;
    sort(): (a: Datum, b: Datum) => number;
    sort(comparator: (a: Datum, b: Datum) => number): this;
    startAngle(): number;
    startAngle(angle: number): this;
    endAngle(): number;
    endAngle(angle: number): this;
    padAngle(): number;
    padAngle(angle: number): this;
  }

  export function line<Datum>(): Line<Datum>;
  export function area<Datum>(): Area<Datum>;
  export function pie<Datum>(): Pie<Datum>;
  export function arc(): any;
} 