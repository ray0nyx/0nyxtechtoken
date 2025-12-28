/**
 * Honeypot Detector
 * 
 * Frontend service for honeypot detection and safety scoring
 */

export interface SafetyScore {
  overall_score: number; // 0-100
  safety_level: 'safe' | 'low_risk' | 'medium_risk' | 'high_risk' | 'danger' | 'honeypot';
  risk_factors: string[];
  is_honeypot: boolean;
  transfer_restrictions: boolean;
  sell_restrictions: boolean;
  tax_on_transfer: boolean;
  blacklisted: boolean;
  liquidity_locked: boolean;
  owner_controls: {
    can_freeze: boolean;
    can_mint: boolean;
    can_burn: boolean;
  };
  details: Record<string, any>;
}

/**
 * Analyze token for honeypot characteristics
 */
export async function analyzeTokenSafety(
  tokenAddress: string,
  simulateBuy: boolean = true,
  simulateSell: boolean = true
): Promise<SafetyScore | null> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    
    const response = await fetch(`${apiUrl}/api/safety/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token_address: tokenAddress,
        simulate_buy: simulateBuy,
        simulate_sell: simulateSell,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Safety analysis failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error analyzing token safety:', error);
    return null;
  }
}

/**
 * Check if token is safe to trade
 */
export function isTokenSafe(score: SafetyScore): boolean {
  return (
    score.safety_level === 'safe' ||
    score.safety_level === 'low_risk'
  ) && !score.is_honeypot;
}

/**
 * Get safety level color for UI
 */
export function getSafetyColor(level: SafetyScore['safety_level']): string {
  switch (level) {
    case 'safe':
      return 'text-green-500';
    case 'low_risk':
      return 'text-green-400';
    case 'medium_risk':
      return 'text-yellow-500';
    case 'high_risk':
      return 'text-orange-500';
    case 'danger':
      return 'text-red-500';
    case 'honeypot':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get safety level badge variant
 */
export function getSafetyBadgeVariant(
  level: SafetyScore['safety_level']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (level) {
    case 'safe':
    case 'low_risk':
      return 'default';
    case 'medium_risk':
      return 'secondary';
    case 'high_risk':
    case 'danger':
      return 'outline';
    case 'honeypot':
      return 'destructive';
    default:
      return 'outline';
  }
}
