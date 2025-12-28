import { cleanMonetaryValue } from './formatters';

/**
 * Clean a numeric value by removing non-numeric characters and handling parentheses for negative values
 * @deprecated Use cleanMonetaryValue from formatters.ts instead
 * @param value The numeric value to clean
 * @returns The cleaned numeric value as a string
 */
export function cleanNumericValue(value: string | null | undefined): string {
  // Use our new function but convert the result back to string for backward compatibility
  return cleanMonetaryValue(value).toString();
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