/**
 * Utility functions for formatting and sanitizing data
 */

/**
 * Cleans a monetary value by removing currency symbols, commas,
 * and handling parentheses for negative values
 * @param value The monetary value to clean
 * @returns A cleaned numeric value
 */
export function cleanMonetaryValue(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  
  try {
    // Make sure value is a string
    const valueStr = String(value);
    
    // Remove currency symbols, commas, and spaces
    let cleanedValue = valueStr.replace(/[$€£¥,\s]/g, '');
    
    // Handle negative values in parentheses: (123.45) -> -123.45
    if (cleanedValue.startsWith('(') && cleanedValue.endsWith(')')) {
      cleanedValue = '-' + cleanedValue.substring(1, cleanedValue.length - 1);
    }
    
    // Handle other special cases
    cleanedValue = cleanedValue
      .replace(/−/g, '-')     // Replace Unicode minus sign
      .replace(/\+/g, '')     // Remove plus signs
      .replace(/^-+/, '-')    // Replace multiple leading minus signs with one
      .replace(/--+/g, '-')   // Replace double minus with one minus
      .replace(/\.+$/, '');   // Remove trailing periods
    
    // Ensure there's only one decimal point (keep the first one)
    const decimalPoints = cleanedValue.match(/\./g);
    if (decimalPoints && decimalPoints.length > 1) {
      const firstDecimal = cleanedValue.indexOf('.');
      cleanedValue = cleanedValue.substring(0, firstDecimal + 1) + 
                     cleanedValue.substring(firstDecimal + 1).replace(/\./g, '');
    }
    
    // If the value is still not a valid number, log it for debugging
    const numericValue = parseFloat(cleanedValue);
    if (isNaN(numericValue)) {
      console.warn(`Failed to parse monetary value: "${value}" (cleaned to "${cleanedValue}")`);
      return 0;
    }
    
    // Extra validation for the PnL value
    // Log the value transformation for debugging purposes
    console.log(`Monetary value transformed: "${value}" -> "${cleanedValue}" -> ${numericValue}`);
    
    return numericValue;
  } catch (error) {
    console.error('Error cleaning monetary value:', value, error);
    return 0;
  }
}

/**
 * Formats a number as a currency string
 * @param value The numeric value to format
 * @param currency The currency symbol to use (defaults to $)
 * @returns A formatted currency string
 */
export function formatCurrency(value: number | null | undefined, currency = '$'): string {
  if (value == null) return `${currency}0.00`;
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(value);
}

/**
 * Special parser for PnL values that ensures dollar signs and other currency symbols are removed
 * and values are properly converted to numbers. This is critical to prevent the 
 * "invalid input syntax for type numeric: '$52.50'" error.
 * 
 * @param value The PnL value to parse, which may contain currency symbols
 * @returns A clean numeric value suitable for database storage
 */
export function parsePnL(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  
  try {
    // Make sure value is a string
    const valueStr = String(value);
    
    // First try the standard monetary value cleaner
    const cleanedValue = cleanMonetaryValue(valueStr);
    if (!isNaN(cleanedValue)) {
      return cleanedValue;
    }
    
    // If that fails, use a more aggressive approach for PnL values
    // Remove ALL non-numeric characters except for decimal points and the negative sign
    let strippedValue = valueStr.replace(/[^0-9.\-]/g, '');
    
    // Ensure there's only one decimal point (keep the first one)
    const decimalPoints = strippedValue.match(/\./g);
    if (decimalPoints && decimalPoints.length > 1) {
      const firstDecimal = strippedValue.indexOf('.');
      strippedValue = strippedValue.substring(0, firstDecimal + 1) + 
                     strippedValue.substring(firstDecimal + 1).replace(/\./g, '');
    }
    
    // Ensure there's only one negative sign at the beginning
    if (strippedValue.includes('-')) {
      strippedValue = (strippedValue.charAt(0) === '-' ? '-' : '') + 
                     strippedValue.replace(/-/g, '');
    }
    
    // Parse the final cleaned value
    const result = parseFloat(strippedValue);
    
    // Log for debugging
    console.log(`PnL parsing: "${value}" -> "${strippedValue}" -> ${result}`);
    
    return isNaN(result) ? 0 : result;
  } catch (error) {
    console.error('Error parsing PnL value:', value, error);
    return 0;
  }
}

/**
 * Formats a date into a readable string
 * @param date The date to format
 * @param format Optional format type ('short' for date only, 'full' for date and time)
 * @returns A formatted date string
 */
export function formatDate(date: Date | string, format: 'short' | 'full' = 'full'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'short') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(dateObj);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(dateObj);
} 