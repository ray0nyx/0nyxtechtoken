/**
 * TopstepX Trade Validation Helper
 * 
 * This utility provides frontend validation for TopstepX CSV data
 * to detect issues before sending to the server
 */

/**
 * Validates a single trade row
 * @param {Object} row - Trade data object
 * @returns {Object} Validation result with status and any error messages
 */
function validateTradeRow(row) {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  const requiredFields = ['contract_name', 'entry_price', 'exit_price', 'entered_at', 'exited_at'];
  
  for (const field of requiredFields) {
    if (!row[field] || row[field].toString().trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // If missing required fields, no need to do further validation
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings
    };
  }

  // Validate numeric fields
  try {
    // Entry price
    const entryPrice = row.entry_price.toString().trim();
    if (!/^-?\d*\.?\d+$/.test(entryPrice.replace(/[$,]/g, ''))) {
      errors.push(`Invalid entry_price format: ${entryPrice}`);
    }
    
    // Exit price
    const exitPrice = row.exit_price.toString().trim();
    if (!/^-?\d*\.?\d+$/.test(exitPrice.replace(/[$,]/g, ''))) {
      errors.push(`Invalid exit_price format: ${exitPrice}`);
    }
    
    // Size (optional)
    if (row.size !== undefined && row.size !== null && row.size !== '') {
      const size = row.size.toString().trim();
      if (!/^-?\d*\.?\d+$/.test(size.replace(/,/g, ''))) {
        errors.push(`Invalid size format: ${size}`);
      }
    }
    
    // PnL (optional)
    if (row.pnl !== undefined && row.pnl !== null && row.pnl !== '') {
      const pnl = row.pnl.toString().trim();
      if (!/^-?\d*\.?\d+$/.test(pnl.replace(/[$,]/g, ''))) {
        errors.push(`Invalid pnl format: ${pnl}`);
      }
    }
    
    // Fees (optional)
    if (row.fees !== undefined && row.fees !== null && row.fees !== '') {
      const fees = row.fees.toString().trim();
      if (!/^-?\d*\.?\d+$/.test(fees.replace(/[$,]/g, ''))) {
        errors.push(`Invalid fees format: ${fees}`);
      }
    }
  } catch (e) {
    errors.push(`Error validating numeric fields: ${e.message}`);
  }
  
  // Validate date fields
  try {
    // Entered at
    const enteredAt = row.entered_at.toString().trim();
    
    // Check ISO format (YYYY-MM-DD)
    const isoPattern = /^\d{4}-\d{2}-\d{2}(T|\s)?\d{2}:\d{2}(:\d{2})?$/;
    // Check MM/DD/YYYY format
    const mdyPattern = /^\d{1,2}\/\d{1,2}\/\d{4}(\s\d{1,2}:\d{1,2}(:\d{1,2})?)?$/;
    
    if (!isoPattern.test(enteredAt) && !mdyPattern.test(enteredAt)) {
      errors.push(`Invalid entered_at date format: ${enteredAt}`);
    }
    
    // Exited at
    const exitedAt = row.exited_at.toString().trim();
    if (!isoPattern.test(exitedAt) && !mdyPattern.test(exitedAt)) {
      errors.push(`Invalid exited_at date format: ${exitedAt}`);
    }
    
    // Additional check: ensure exited_at is after entered_at
    const enteredDate = new Date(enteredAt);
    const exitedDate = new Date(exitedAt);
    
    if (!isNaN(enteredDate.getTime()) && !isNaN(exitedDate.getTime())) {
      if (exitedDate < enteredDate) {
        warnings.push(`Exit date (${exitedAt}) is before entry date (${enteredAt})`);
      }
    }
  } catch (e) {
    errors.push(`Error validating date fields: ${e.message}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates an array of trade rows
 * @param {Array} rows - Array of trade data objects
 * @returns {Object} Validation results with valid/invalid counts and details
 */
function validateTrades(rows) {
  if (!Array.isArray(rows)) {
    return {
      valid: false,
      message: 'Input is not an array',
      validCount: 0,
      invalidCount: 0,
      details: []
    };
  }
  
  if (rows.length === 0) {
    return {
      valid: false,
      message: 'No trades to validate',
      validCount: 0,
      invalidCount: 0,
      details: []
    };
  }
  
  let validCount = 0;
  let invalidCount = 0;
  const details = [];
  
  // Validate each row
  rows.forEach((row, index) => {
    const result = validateTradeRow(row);
    
    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
    }
    
    details.push({
      rowIndex: index,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      data: row
    });
  });
  
  return {
    valid: invalidCount === 0,
    message: invalidCount === 0 
      ? `All ${validCount} trade rows are valid` 
      : `Found ${invalidCount} invalid trade rows`,
    validCount,
    invalidCount,
    details
  };
}

/**
 * Utility function to clean trade data before submission
 * @param {Object} row - Trade data object
 * @returns {Object} Cleaned trade data
 */
function cleanTradeRow(row) {
  const cleaned = { ...row };
  
  // Clean numeric fields
  if (cleaned.entry_price !== undefined) {
    cleaned.entry_price = cleaned.entry_price.toString().replace(/[$,]/g, '').trim();
  }
  
  if (cleaned.exit_price !== undefined) {
    cleaned.exit_price = cleaned.exit_price.toString().replace(/[$,]/g, '').trim();
  }
  
  if (cleaned.size !== undefined && cleaned.size !== null && cleaned.size !== '') {
    cleaned.size = cleaned.size.toString().replace(/,/g, '').trim();
  }
  
  if (cleaned.pnl !== undefined && cleaned.pnl !== null && cleaned.pnl !== '') {
    cleaned.pnl = cleaned.pnl.toString().replace(/[$,]/g, '').trim();
  }
  
  if (cleaned.fees !== undefined && cleaned.fees !== null && cleaned.fees !== '') {
    cleaned.fees = cleaned.fees.toString().replace(/[$,]/g, '').trim();
  }
  
  // Clean date fields - convert to ISO format if needed
  if (cleaned.entered_at) {
    const enteredAt = cleaned.entered_at.toString().trim();
    // If it's in MM/DD/YYYY format, convert to ISO
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(enteredAt)) {
      const parts = enteredAt.split(/[\s\/]/);
      if (parts.length >= 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        
        let timeComponent = '';
        if (parts.length > 3) {
          timeComponent = 'T' + parts.slice(3).join(':');
        } else {
          timeComponent = 'T00:00:00';
        }
        
        cleaned.entered_at = `${year}-${month}-${day}${timeComponent}`;
      }
    }
  }
  
  if (cleaned.exited_at) {
    const exitedAt = cleaned.exited_at.toString().trim();
    // If it's in MM/DD/YYYY format, convert to ISO
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(exitedAt)) {
      const parts = exitedAt.split(/[\s\/]/);
      if (parts.length >= 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        
        let timeComponent = '';
        if (parts.length > 3) {
          timeComponent = 'T' + parts.slice(3).join(':');
        } else {
          timeComponent = 'T00:00:00';
        }
        
        cleaned.exited_at = `${year}-${month}-${day}${timeComponent}`;
      }
    }
  }
  
  return cleaned;
}

/**
 * Cleans an array of trade rows before submission
 * @param {Array} rows - Array of trade data objects
 * @returns {Array} Array of cleaned trade data objects
 */
function cleanTrades(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  
  return rows.map(cleanTradeRow);
}

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateTradeRow,
    validateTrades,
    cleanTradeRow,
    cleanTrades
  };
}

// For browser environment
if (typeof window !== 'undefined') {
  window.TopstepXValidator = {
    validateTradeRow,
    validateTrades,
    cleanTradeRow,
    cleanTrades
  };
} 