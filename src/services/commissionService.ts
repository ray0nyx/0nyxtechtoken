import { supabase } from '@/lib/supabase';

export interface Commission {
  id: string;
  referral_id: string;
  affiliate_id: string;
  user_id: string;
  amount: number;
  event_type: string;
  status: string;
  stripe_subscription_id?: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  stripe_customer_id?: string;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CommissionSummary {
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  failedCommissions: number;
  cancelledCommissions: number;
  totalReferrals: number;
  activeReferrals: number;
  byAffiliate: Record<string, {
    total: number;
    pending: number;
    paid: number;
    referrals: number;
  }>;
}

export interface PayoutRequest {
  affiliate_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
}

class CommissionService {
  // Commission calculation rules
  private readonly COMMISSION_RATES = {
    subscription: 0.30, // 30% for subscription payments
    one_time: 0.20,     // 20% for one-time payments
    trial: 0.00,        // 0% for trial periods
  };

  private readonly MIN_COMMISSION = 1.00; // $1 minimum

  // Calculate commission amount
  calculateCommission(amount: number, type: 'subscription' | 'one_time' | 'trial'): number {
    const rate = this.COMMISSION_RATES[type];
    const commission = amount * rate;
    return Math.max(commission, this.MIN_COMMISSION);
  }

  // Get commission summary for admin dashboard
  async getCommissionSummary(params: {
    affiliate_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  } = {}): Promise<CommissionSummary> {
    try {
      let query = supabase
        .from('commissions')
        .select(`
          id,
          affiliate_id,
          amount,
          status,
          referrals!inner(id, affiliate_id)
        `);

      // Apply filters
      if (params.affiliate_id) {
        query = query.eq('affiliate_id', params.affiliate_id);
      }
      if (params.start_date) {
        query = query.gte('created_at', params.start_date);
      }
      if (params.end_date) {
        query = query.lte('created_at', params.end_date);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }

      const { data: commissions, error } = await query;

      if (error) {
        console.error('Error fetching commission summary:', error);
        throw error;
      }

      // Calculate summary
      const summary: CommissionSummary = {
        totalCommissions: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        failedCommissions: 0,
        cancelledCommissions: 0,
        totalReferrals: 0,
        activeReferrals: 0,
        byAffiliate: {}
      };

      const affiliateStats = new Map<string, { total: number; pending: number; paid: number; referrals: Set<string> }>();

      commissions?.forEach(commission => {
        const amount = Number(commission.amount);
        summary.totalCommissions += amount;

        // Count by status
        switch (commission.status) {
          case 'pending':
            summary.pendingCommissions += amount;
            break;
          case 'paid':
            summary.paidCommissions += amount;
            break;
          case 'failed':
            summary.failedCommissions += amount;
            break;
          case 'cancelled':
            summary.cancelledCommissions += amount;
            break;
        }

        // Track by affiliate
        const affiliateId = commission.affiliate_id;
        if (!affiliateStats.has(affiliateId)) {
          affiliateStats.set(affiliateId, { total: 0, pending: 0, paid: 0, referrals: new Set() });
        }

        const stats = affiliateStats.get(affiliateId)!;
        stats.total += amount;
        stats.referrals.add(commission.referrals.id);

        if (commission.status === 'pending') {
          stats.pending += amount;
        } else if (commission.status === 'paid') {
          stats.paid += amount;
        }
      });

      // Convert affiliate stats to summary format
      affiliateStats.forEach((stats, affiliateId) => {
        summary.byAffiliate[affiliateId] = {
          total: stats.total,
          pending: stats.pending,
          paid: stats.paid,
          referrals: stats.referrals.size
        };
      });

      // Get referral counts
      const { data: referrals } = await supabase
        .from('referrals')
        .select('id, status')
        .eq('status', 'active');

      summary.totalReferrals = referrals?.length || 0;
      summary.activeReferrals = referrals?.filter(r => r.status === 'active').length || 0;

      return summary;
    } catch (error) {
      console.error('Error in getCommissionSummary:', error);
      throw error;
    }
  }

  // Get commissions for an affiliate
  async getAffiliateCommissions(affiliateId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    event_type?: string;
  } = {}): Promise<{ commissions: Commission[]; total: number }> {
    try {
      const { page = 1, limit = 10, status, event_type } = params;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('commissions')
        .select('*', { count: 'exact' })
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }
      if (event_type) {
        query = query.eq('event_type', event_type);
      }

      query = query.range(offset, offset + limit - 1);

      const { data: commissions, error, count } = await query;

      if (error) {
        console.error('Error fetching affiliate commissions:', error);
        throw error;
      }

      return {
        commissions: commissions || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error in getAffiliateCommissions:', error);
      throw error;
    }
  }

  // Get pending commissions for payout
  async getPendingCommissions(affiliateId?: string): Promise<Commission[]> {
    try {
      let query = supabase
        .from('commissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }

      const { data: commissions, error } = await query;

      if (error) {
        console.error('Error fetching pending commissions:', error);
        throw error;
      }

      return commissions || [];
    } catch (error) {
      console.error('Error in getPendingCommissions:', error);
      throw error;
    }
  }

  // Process payout for an affiliate
  async processPayout(payoutRequest: PayoutRequest): Promise<{ success: boolean; message: string }> {
    try {
      const { affiliate_id, amount, payment_method, notes } = payoutRequest;

      // Get pending commissions for this affiliate
      const pendingCommissions = await this.getPendingCommissions(affiliate_id);
      const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.amount), 0);

      if (totalPending < amount) {
        throw new Error(`Insufficient pending commissions. Available: $${totalPending.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
      }

      // Mark commissions as paid
      const commissionIds = pendingCommissions
        .slice(0, Math.ceil(amount / this.MIN_COMMISSION)) // Approximate number of commissions needed
        .map(c => c.id);

      const { error: updateError } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          notes: `Paid via ${payment_method}. ${notes || ''}`,
          updated_at: new Date().toISOString()
        })
        .in('id', commissionIds);

      if (updateError) {
        console.error('Error updating commission status:', updateError);
        throw updateError;
      }

      // Create payout record (you might want to create a payouts table)
      console.log(`Payout processed for affiliate ${affiliate_id}: $${amount} via ${payment_method}`);

      return {
        success: true,
        message: `Payout of $${amount.toFixed(2)} processed successfully via ${payment_method}`
      };
    } catch (error) {
      console.error('Error processing payout:', error);
      throw error;
    }
  }

  // Get commission statistics
  async getCommissionStats(params: {
    affiliate_id?: string;
    period?: 'day' | 'week' | 'month' | 'year';
  } = {}): Promise<{
    totalEarnings: number;
    averageCommission: number;
    totalTransactions: number;
    successRate: number;
  }> {
    try {
      const { affiliate_id, period = 'month' } = params;

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      let query = supabase
        .from('commissions')
        .select('amount, status')
        .gte('created_at', startDate.toISOString());

      if (affiliate_id) {
        query = query.eq('affiliate_id', affiliate_id);
      }

      const { data: commissions, error } = await query;

      if (error) {
        console.error('Error fetching commission stats:', error);
        throw error;
      }

      const totalEarnings = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const totalTransactions = commissions?.length || 0;
      const successfulTransactions = commissions?.filter(c => c.status === 'paid').length || 0;
      const averageCommission = totalTransactions > 0 ? totalEarnings / totalTransactions : 0;
      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

      return {
        totalEarnings,
        averageCommission,
        totalTransactions,
        successRate
      };
    } catch (error) {
      console.error('Error in getCommissionStats:', error);
      throw error;
    }
  }

  // Validate commission calculation
  validateCommissionCalculation(amount: number, rate: number): boolean {
    const calculatedCommission = amount * rate;
    return calculatedCommission >= this.MIN_COMMISSION;
  }

  // Get commission history for a user
  async getUserCommissionHistory(userId: string): Promise<Commission[]> {
    try {
      const { data: commissions, error } = await supabase
        .from('commissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user commission history:', error);
        throw error;
      }

      return commissions || [];
    } catch (error) {
      console.error('Error in getUserCommissionHistory:', error);
      throw error;
    }
  }

  // Mark commissions as paid (bulk operation)
  async markCommissionsAsPaid(commissionIds: string[], paymentMethod: string, notes?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          notes: `Paid via ${paymentMethod}. ${notes || ''}`,
          updated_at: new Date().toISOString()
        })
        .in('id', commissionIds);

      if (error) {
        console.error('Error marking commissions as paid:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in markCommissionsAsPaid:', error);
      throw error;
    }
  }

  // Get commission events by type
  async getCommissionsByEventType(eventType: string, params: {
    affiliate_id?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<Commission[]> {
    try {
      let query = supabase
        .from('commissions')
        .select('*')
        .eq('event_type', eventType)
        .order('created_at', { ascending: false });

      if (params.affiliate_id) {
        query = query.eq('affiliate_id', params.affiliate_id);
      }
      if (params.start_date) {
        query = query.gte('created_at', params.start_date);
      }
      if (params.end_date) {
        query = query.lte('created_at', params.end_date);
      }

      const { data: commissions, error } = await query;

      if (error) {
        console.error('Error fetching commissions by event type:', error);
        throw error;
      }

      return commissions || [];
    } catch (error) {
      console.error('Error in getCommissionsByEventType:', error);
      throw error;
    }
  }
}

export const commissionService = new CommissionService(); 