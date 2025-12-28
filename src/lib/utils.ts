import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Theme = "dark" | "light" | "system"

export function getSystemTheme(): Theme {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark"
  }
  return "light"
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Parse a P&L value from a string, handling different formats
 * @param value The P&L value as a string
 * @returns The parsed P&L value as a number
 */
export function parsePnlValue(value: string | undefined): number {
  if (!value) return 0;
  
  try {
    // Remove dollar signs, commas, and other non-numeric characters except decimal points and negative signs
    const cleanedValue = value.replace(/[$,]/g, '').trim();
    
    // Handle parentheses for negative numbers (accounting notation)
    const isNegative = cleanedValue.startsWith('(') && cleanedValue.endsWith(')');
    const numericValue = isNegative 
      ? -parseFloat(cleanedValue.substring(1, cleanedValue.length - 1))
      : parseFloat(cleanedValue);
    
    // Check if the result is a valid number
    if (isNaN(numericValue)) {
      console.warn(`Invalid PnL value: "${value}" parsed as 0`);
      return 0;
    }
    
    return numericValue;
  } catch (error) {
    console.error(`Error parsing PnL value: "${value}"`, error);
    return 0;
  }
}

// Standard deviation of an array
export function standardDeviation(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// Downside deviation (for Sortino ratio)
export function downsideDeviation(arr: number[], riskFreeRate = 0): number {
  if (!arr.length) return 0;
  const downside = arr.filter(r => r < riskFreeRate);
  if (!downside.length) return 0;
  const mean = downside.reduce((a, b) => a + b, 0) / downside.length;
  const variance = downside.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / downside.length;
  return Math.sqrt(variance);
}

// Sharpe ratio
export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  if (!returns.length) return 0;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = standardDeviation(returns);
  return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
}

// Sortino ratio
export function sortinoRatio(returns: number[], riskFreeRate = 0): number {
  if (!returns.length) return 0;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const dd = downsideDeviation(returns, riskFreeRate);
  return dd > 0 ? (avgReturn - riskFreeRate) / dd : 0;
}

// Expectancy calculation
export function expectancy(winRate: number, avgWin: number, avgLoss: number): number {
  const lossRate = 1 - winRate;
  return (winRate * avgWin) - (lossRate * Math.abs(avgLoss));
}
