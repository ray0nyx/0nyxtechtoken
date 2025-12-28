import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type Trade = Database['public']['Tables']['trades']['Row'];
type TradeInsert = Database['public']['Tables']['trades']['Insert'];
type TradeUpdate = Database['public']['Tables']['trades']['Update'];

class TradeService {
  async createTrade(trade: TradeInsert) {
    const { data, error } = await supabase
      .from('trades')
      .insert(trade)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateTrade(id: string, trade: TradeUpdate) {
    const { data, error } = await supabase
      .from('trades')
      .update(trade)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async deleteTrade(id: string) {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getTrade(id: string) {
    const { data, error } = await supabase
      .from('trades')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async getUserTrades(userId: string) {
    const { data, error } = await supabase
      .from('trades')
      .select()
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async importTrades(trades: TradeInsert[]) {
    const { data, error } = await supabase
      .from('trades')
      .insert(trades)
      .select();

    if (error) {
      throw error;
    }

    return data;
  }
}

export const tradeService = new TradeService(); 