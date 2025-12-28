declare module 'recharts' {
  import * as React from 'react';

  // Include d3 dependencies
  export * from 'd3-scale';
  export * from 'd3-shape';

  export interface PieProps {
    data?: Array<any>;
    cx?: string | number;
    cy?: string | number;
    innerRadius?: number;
    outerRadius?: number;
    paddingAngle?: number;
    dataKey?: string;
    label?: boolean | Function | React.ReactElement | object;
    labelLine?: boolean | object | React.ReactElement;
    children?: React.ReactNode;
  }

  export interface CellProps {
    key?: string;
    fill?: string;
    className?: string;
  }

  export interface TooltipProps {
    content?: React.ReactElement | React.FC<any>;
    active?: boolean;
    payload?: Array<any>;
  }

  export const PieChart: React.FC<any>;
  export const Pie: React.FC<PieProps>;
  export const Cell: React.FC<CellProps>;
  export const ResponsiveContainer: React.FC<any>;
  export const Tooltip: React.FC<TooltipProps>;
  
  // Add missing components
  export const BarChart: React.FC<any>;
  export const Bar: React.FC<any>;
  export const XAxis: React.FC<any>;
  export const YAxis: React.FC<any>;
  export const CartesianGrid: React.FC<any>;
  export const LineChart: React.FC<any>;
  export const Line: React.FC<any>;
  export const ScatterChart: React.FC<any>;
  export const Scatter: React.FC<any>;
  export const ZAxis: React.FC<any>;
  export const Area: React.FC<any>;
  export const AreaChart: React.FC<any>;
} 