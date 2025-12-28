/**
 * Jupiter Route Comparator
 * 
 * Compares multiple swap routes and selects the best one based on various criteria.
 */

import type {
  QuoteResponse,
  RoutePlanStep,
} from '@jup-ag/api';
import type {
  EnhancedQuoteResponse,
  QuoteComparison,
  RouteSelectionStrategy,
  RouteAnalysis,
} from '@/types/jupiter';
import { enhanceQuote } from './jupiter-sdk-service';

/**
 * Compare multiple quotes and rank them
 */
export function compareQuotes(
  quotes: QuoteResponse[],
  strategy: RouteSelectionStrategy = 'balanced'
): QuoteComparison[] {
  const enhanced = quotes.map(enhanceQuote);
  const comparisons = enhanced.map((quote, index) => 
    analyzeRoute(quote, index)
  );

  // Score each route based on strategy
  const scored = comparisons.map(comparison => ({
    ...comparison,
    score: calculateScore(comparison, strategy),
  }));

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  // Add ranking
  return scored.map((comparison, index) => ({
    ...comparison,
    ranking: index + 1,
  }));
}

/**
 * Select the best quote based on strategy
 */
export function selectBestQuote(
  quotes: QuoteResponse[],
  strategy: RouteSelectionStrategy = 'balanced'
): QuoteComparison | null {
  const comparisons = compareQuotes(quotes, strategy);
  return comparisons[0] || null;
}

/**
 * Analyze a single route
 */
function analyzeRoute(
  quote: EnhancedQuoteResponse,
  index: number
): QuoteComparison {
  const analysis = getRouteAnalysis(quote);
  
  const advantages: string[] = [];
  const disadvantages: string[] = [];

  // Analyze advantages and disadvantages
  if (analysis.priceImpact < 1) {
    advantages.push('Low price impact');
  } else if (analysis.priceImpact > 5) {
    disadvantages.push('High price impact');
  }

  if (analysis.totalHops === 1) {
    advantages.push('Direct route (single hop)');
  } else if (analysis.totalHops > 3) {
    disadvantages.push('Complex route (multiple hops)');
  }

  if (analysis.liquidityScore > 0.8) {
    advantages.push('High liquidity');
  } else if (analysis.liquidityScore < 0.5) {
    disadvantages.push('Low liquidity');
  }

  const outAmount = parseFloat(quote.outAmount);
  if (outAmount > 0) {
    advantages.push(`Output: ${outAmount.toFixed(6)}`);
  }

  return {
    quote,
    score: 0, // Will be calculated later
    ranking: index + 1,
    advantages,
    disadvantages,
  };
}

/**
 * Get detailed route analysis
 */
export function getRouteAnalysis(quote: EnhancedQuoteResponse): RouteAnalysis {
  const routeSteps = quote.routePlan || [];
  const totalHops = routeSteps.length;
  
  // Extract DEXes used
  const dexesUsed = routeSteps
    .map(step => step.swapInfo?.label || 'Unknown')
    .filter((dex, index, self) => self.indexOf(dex) === index);

  // Calculate estimated gas (simplified)
  const estimatedGas = totalHops * 5000; // Rough estimate per hop

  // Price impact from quote
  const priceImpact = quote.priceImpactPct || 0;

  // Liquidity score (simplified - would need actual liquidity data)
  const liquidityScore = calculateLiquidityScoreInternal(quote);

  return {
    quote,
    routeSteps,
    totalHops,
    dexesUsed,
    estimatedGas,
    priceImpact,
    liquidityScore,
  };
}

/**
 * Calculate liquidity score (0-1)
 */
function calculateLiquidityScoreInternal(quote: EnhancedQuoteResponse): number {
  // Simplified liquidity score based on:
  // - Route complexity (fewer hops = better)
  // - Output amount (higher = better liquidity)
  // - Price impact (lower = better)
  
  const complexityScore = Math.max(0, 1 - (quote.routeComplexity - 1) * 0.2);
  const impactScore = Math.max(0, 1 - quote.priceImpactPct / 10);
  const amountScore = parseFloat(quote.outAmount) > 0 ? 1 : 0;

  return (complexityScore + impactScore + amountScore) / 3;
}

/**
 * Calculate route score based on strategy
 */
function calculateScore(
  comparison: QuoteComparison,
  strategy: RouteSelectionStrategy
): number {
  const { quote, advantages, disadvantages } = comparison;
  const outAmount = parseFloat(quote.outAmount);
  const inAmount = parseFloat(quote.inAmount);
  const priceImpact = quote.priceImpactPct;
  const routeComplexity = quote.routeComplexity;

  let score = 0;

  switch (strategy) {
    case 'best-output':
      // Prioritize highest output amount
      score = outAmount / (inAmount || 1) * 100;
      break;

    case 'lowest-impact':
      // Prioritize lowest price impact
      score = Math.max(0, 100 - priceImpact * 10);
      break;

    case 'best-liquidity':
      // Prioritize liquidity score
      const liquidityScoreForBest = calculateLiquidityScoreInternal(quote);
      score = liquidityScoreForBest * 100;
      break;

    case 'lowest-fees':
      // Prioritize routes with fewer hops (fewer fees)
      score = Math.max(0, 100 - (routeComplexity - 1) * 20);
      break;

    case 'fastest':
      // Prioritize direct routes (fastest execution)
      score = routeComplexity === 1 ? 100 : Math.max(0, 100 - (routeComplexity - 1) * 30);
      break;

    case 'balanced':
    default:
      // Balanced scoring across all factors
      const outputScore = (outAmount / (inAmount || 1)) * 40;
      const impactScore = Math.max(0, (10 - priceImpact) * 3);
      const complexityScore = Math.max(0, (4 - routeComplexity) * 5);
      const liquidityScoreForBalanced = calculateLiquidityScoreInternal(quote) * 20;
      
      score = outputScore + impactScore + complexityScore + liquidityScoreForBalanced;
      break;
  }

  // Adjust score based on advantages/disadvantages
  score += advantages.length * 5;
  score -= disadvantages.length * 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Validate a quote before execution
 */
export function validateQuote(quote: QuoteResponse): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!quote.inputMint) {
    errors.push('Missing input mint');
  }
  if (!quote.outputMint) {
    errors.push('Missing output mint');
  }
  if (!quote.inAmount || parseFloat(quote.inAmount) <= 0) {
    errors.push('Invalid input amount');
  }
  if (!quote.outAmount || parseFloat(quote.outAmount) <= 0) {
    errors.push('Invalid output amount');
  }

  // Check slippage
  if (quote.slippageBps > 1000) {
    warnings.push('High slippage tolerance (>10%)');
  }

  // Check route plan
  if (!quote.routePlan || quote.routePlan.length === 0) {
    errors.push('No route plan available');
  }

  // Check price impact (if available)
  const priceImpact = (quote as any).priceImpactPct;
  if (priceImpact && priceImpact > 5) {
    warnings.push(`High price impact: ${priceImpact}%`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Compare two quotes side by side
 */
export function compareTwoQuotes(
  quote1: QuoteResponse,
  quote2: QuoteResponse
): {
  better: 'quote1' | 'quote2' | 'equal';
  differences: {
    outputAmount: number; // Difference in output amount
    priceImpact: number; // Difference in price impact
    complexity: number; // Difference in route complexity
  };
} {
  const enhanced1 = enhanceQuote(quote1);
  const enhanced2 = enhanceQuote(quote2);

  const outAmount1 = parseFloat(enhanced1.outAmount);
  const outAmount2 = parseFloat(enhanced2.outAmount);
  const impact1 = enhanced1.priceImpactPct;
  const impact2 = enhanced2.priceImpactPct;
  const complexity1 = enhanced1.routeComplexity;
  const complexity2 = enhanced2.routeComplexity;

  const differences = {
    outputAmount: outAmount2 - outAmount1,
    priceImpact: impact2 - impact1,
    complexity: complexity2 - complexity1,
  };

  // Determine which is better (higher output, lower impact, lower complexity)
  let score1 = 0;
  let score2 = 0;

  score1 += outAmount1 * 0.5;
  score2 += outAmount2 * 0.5;
  score1 += (10 - impact1) * 3;
  score2 += (10 - impact2) * 3;
  score1 += (5 - complexity1) * 2;
  score2 += (5 - complexity2) * 2;

  let better: 'quote1' | 'quote2' | 'equal';
  if (Math.abs(score1 - score2) < 0.01) {
    better = 'equal';
  } else {
    better = score1 > score2 ? 'quote1' : 'quote2';
  }

  return { better, differences };
}
