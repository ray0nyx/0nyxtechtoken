import { createClient } from './supabase/client';

export interface PriceAlert {
  id: string;
  user_id: string;
  pair_symbol: string;
  alert_type: 'above' | 'below';
  threshold_price: number;
  is_active: boolean;
  created_at: string;
  triggered_at: string | null;
}

/**
 * Create a new price alert
 */
export async function createPriceAlert(
  pairSymbol: string,
  alertType: 'above' | 'below',
  thresholdPrice: number
): Promise<PriceAlert> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data, error } = await supabase
    .from('price_alerts')
    .insert({
      user_id: user.id,
      pair_symbol: pairSymbol,
      alert_type: alertType,
      threshold_price: thresholdPrice,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get all active price alerts for the current user
 */
export async function getUserPriceAlerts(): Promise<PriceAlert[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching price alerts:', error);
    return [];
  }

  return data || [];
}

/**
 * Update a price alert
 */
export async function updatePriceAlert(
  alertId: string,
  updates: Partial<Pick<PriceAlert, 'threshold_price' | 'is_active' | 'alert_type'>>
): Promise<PriceAlert> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data, error } = await supabase
    .from('price_alerts')
    .update(updates)
    .eq('id', alertId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(alertId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', user.id);

  if (error) {
    throw error;
  }
}

/**
 * Check if a price alert should be triggered
 */
export function shouldTriggerAlert(alert: PriceAlert, currentPrice: number): boolean {
  if (!alert.is_active || alert.triggered_at) {
    return false;
  }

  if (alert.alert_type === 'above') {
    return currentPrice >= alert.threshold_price;
  } else {
    return currentPrice <= alert.threshold_price;
  }
}
