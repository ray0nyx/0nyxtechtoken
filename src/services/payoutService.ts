import { supabase } from '@/lib/supabase';

export interface BankDetails {
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  routing_number: string;
  account_type: 'checking' | 'savings';
  country: string;
}

export interface PayoutRequest {
  id: string;
  affiliate_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payment_method: string;
  bank_details?: BankDetails;
  stripe_transfer_id?: string;
  paypal_transaction_id?: string;
  notes?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PayoutSettings {
  minimum_payout_amount: number;
  payout_frequency: 'manual' | 'weekly' | 'monthly';
  processing_days: number;
  currency: string;
  stripe_connect_enabled: boolean;
  paypal_enabled: boolean;
  bank_transfer_enabled: boolean;
}

class PayoutService {
  // Get payout settings
  async getPayoutSettings(): Promise<PayoutSettings> {
    const { data, error } = await supabase
      .from('payout_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching payout settings:', error);
      // Return default settings if table doesn't exist
      return {
        minimum_payout_amount: 50.00,
        payout_frequency: 'manual',
        processing_days: 3,
        currency: 'USD',
        stripe_connect_enabled: false,
        paypal_enabled: false,
        bank_transfer_enabled: true
      };
    }

    return data;
  }

  // Get affiliate's bank details
  async getBankDetails(affiliateId: string): Promise<BankDetails | null> {
    const { data, error } = await supabase
      .from('affiliate_bank_details')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching bank details:', error);
      // Return null if table doesn't exist or other error
      return null;
    }

    return data;
  }

  // Save bank details
  async saveBankDetails(affiliateId: string, bankDetails: BankDetails): Promise<void> {
    const { error } = await supabase
      .from('affiliate_bank_details')
      .upsert({
        affiliate_id: affiliateId,
        ...bankDetails,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving bank details:', error);
      // Show user-friendly message if table doesn't exist
      throw new Error('Payout system is not yet configured. Please contact support.');
    }
  }

  // Get available payout amount
  async getAvailablePayoutAmount(affiliateId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_available_payout_amount', { affiliate_uuid: affiliateId });

    if (error) {
      console.error('Error calculating available payout amount:', error);
      // Fallback: calculate from commissions table directly
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount')
        .eq('affiliate_id', affiliateId)
        .eq('status', 'pending');

      return commissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
    }

    return data || 0;
  }

  // Create payout request
  async createPayoutRequest(affiliateId: string, amount: number): Promise<string> {
    const { data, error } = await supabase
      .rpc('create_payout_request', {
        affiliate_uuid: affiliateId,
        requested_amount: amount
      });

    if (error) {
      console.error('Error creating payout request:', error);
      throw new Error('Payout system is not yet configured. Please contact support.');
    }

    return data;
  }

  // Get affiliate's payout history
  async getPayoutHistory(affiliateId: string): Promise<PayoutRequest[]> {
    const { data, error } = await supabase
      .from('payouts')
      .select(`
        *,
        payout_commissions (
          commission_id,
          commissions (
            amount,
            description,
            created_at
          )
        )
      `)
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payout history:', error);
      // Return empty array if table doesn't exist
      return [];
    }

    return data || [];
  }

  // Get pending payouts (admin only)
  async getPendingPayouts(): Promise<PayoutRequest[]> {
    const { data, error } = await supabase
      .from('payouts')
      .select(`
        *,
        affiliates (
          name,
          email,
          referral_code
        ),
        payout_commissions (
          commission_id,
          commissions (
            amount,
            description,
            created_at
          )
        )
      `)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending payouts:', error);
      throw new Error('Failed to fetch pending payouts');
    }

    return data || [];
  }

  // Update payout status (admin only)
  async updatePayoutStatus(
    payoutId: string, 
    status: PayoutRequest['status'], 
    notes?: string,
    stripeTransferId?: string,
    paypalTransactionId?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (notes) updateData.notes = notes;
    if (stripeTransferId) updateData.stripe_transfer_id = stripeTransferId;
    if (paypalTransactionId) updateData.paypal_transaction_id = paypalTransactionId;
    if (status === 'completed') updateData.processed_at = new Date().toISOString();

    const { error } = await supabase
      .from('payouts')
      .update(updateData)
      .eq('id', payoutId);

    if (error) {
      console.error('Error updating payout status:', error);
      throw new Error('Failed to update payout status');
    }

    // If completed, mark commissions as paid
    if (status === 'completed') {
      const { error: commissionError } = await supabase
        .from('commissions')
        .update({ 
          status: 'paid', 
          updated_at: new Date().toISOString() 
        })
        .in('id', 
          supabase
            .from('payout_commissions')
            .select('commission_id')
            .eq('payout_id', payoutId)
        );

      if (commissionError) {
        console.error('Error updating commission status:', commissionError);
        // Don't throw here as payout is already marked as completed
      }
    }
  }

  // Cancel payout request
  async cancelPayoutRequest(payoutId: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('payouts')
      .update({
        status: 'cancelled',
        notes: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    if (error) {
      console.error('Error cancelling payout request:', error);
      throw new Error('Failed to cancel payout request');
    }

    // Mark commissions as pending again
    const { error: commissionError } = await supabase
      .from('commissions')
      .update({ 
        status: 'pending', 
        updated_at: new Date().toISOString() 
      })
      .in('id', 
        supabase
          .from('payout_commissions')
          .select('commission_id')
          .eq('payout_id', payoutId)
      );

    if (commissionError) {
      console.error('Error reverting commission status:', commissionError);
    }
  }

  // Get payout statistics
  async getPayoutStats(affiliateId: string): Promise<{
    totalEarned: number;
    totalPaid: number;
    pendingAmount: number;
    availablePayout: number;
    nextPayoutDate?: string;
  }> {
    const [payoutHistory, availableAmount] = await Promise.all([
      this.getPayoutHistory(affiliateId),
      this.getAvailablePayoutAmount(affiliateId)
    ]);

    const totalPaid = payoutHistory
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = payoutHistory
      .filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);

    // Get total earned from commissions
    const { data: commissions } = await supabase
      .from('commissions')
      .select('amount')
      .eq('affiliate_id', affiliateId)
      .in('status', ['paid', 'pending', 'processing']);

    const totalEarned = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0;

    return {
      totalEarned,
      totalPaid,
      pendingAmount,
      availablePayout: availableAmount,
      nextPayoutDate: undefined // Could be calculated based on payout frequency
    };
  }
}

export const payoutService = new PayoutService();
