/**
 * Safety Score Component
 * 
 * Comprehensive safety scoring for tokens
 */

import { analyzeTokenSafety, type SafetyScore, isTokenSafe, getSafetyColor, getSafetyBadgeVariant } from './honeypot-detector';

export { analyzeTokenSafety, isTokenSafe, getSafetyColor, getSafetyBadgeVariant };
export type { SafetyScore };

/**
 * Validate token before swap execution
 */
export async function validateTokenBeforeSwap(
  tokenAddress: string
): Promise<{ safe: boolean; score?: SafetyScore; error?: string }> {
  const score = await analyzeTokenSafety(tokenAddress);
  
  if (!score) {
    return {
      safe: false,
      error: 'Failed to analyze token safety',
    };
  }
  
  if (score.is_honeypot) {
    return {
      safe: false,
      score,
      error: 'Token is a honeypot - trading blocked',
    };
  }
  
  if (score.sell_restrictions) {
    return {
      safe: false,
      score,
      error: 'Token has sell restrictions - trading blocked',
    };
  }
  
  if (score.safety_level === 'danger' || score.safety_level === 'honeypot') {
    return {
      safe: false,
      score,
      error: `Token safety level is ${score.safety_level} - trading blocked`,
    };
  }
  
  return {
    safe: isTokenSafe(score),
    score,
  };
}
