import { supabase } from '@/lib/supabase';

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  status: string;
  referral_code: string;
  commission_rate: number;
  date_applied: string;
}

export interface Referral {
  id: string;
  affiliate_id: string;
  user_id: string;
  commission_amount: number;
  status: string;
  date: string;
  affiliates?: {
    id: string;
    name: string;
    email: string;
    referral_code: string;
    commission_rate: number;
  };
  users?: {
    id: string;
    email: string;
    created_at: string;
  };
}

export interface CommissionSummary {
  totalReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  byAffiliate: Record<string, any>;
}

export interface CreateAffiliateData {
  name: string;
  email: string;
  status: string;
  referral_code: string;
  commission_rate: number;
}

export interface UpdateAffiliateData {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  referral_code?: string;
  commission_rate?: number;
}

class AffiliateService {
  // Get all affiliates with pagination and filters
  async getAffiliates(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);

    const response = await fetch(`/api/admin/affiliates?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch affiliates');
    }
    
    return response.json();
  }

  // Create a new affiliate
  async createAffiliate(data: CreateAffiliateData) {
    const response = await fetch('/api/admin/affiliates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create affiliate');
    }

    return response.json();
  }

  // Update an affiliate
  async updateAffiliate(data: UpdateAffiliateData) {
    const response = await fetch('/api/admin/affiliates', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update affiliate');
    }

    return response.json();
  }

  // Delete an affiliate
  async deleteAffiliate(id: string) {
    const response = await fetch(`/api/admin/affiliates?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete affiliate');
    }

    return response.json();
  }

  // Get all referrals
  async getReferrals(params: {
    page?: number;
    limit?: number;
    status?: string;
    affiliate_id?: string;
    user_id?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.affiliate_id) searchParams.append('affiliate_id', params.affiliate_id);
    if (params.user_id) searchParams.append('user_id', params.user_id);

    const response = await fetch(`/api/admin/referrals?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch referrals');
    }
    
    return response.json();
  }

  // Create a new referral
  async createReferral(data: {
    affiliate_id: string;
    user_id: string;
    commission_amount: number;
    status: string;
  }) {
    const response = await fetch('/api/admin/referrals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create referral');
    }

    return response.json();
  }

  // Update a referral
  async updateReferral(data: {
    id: string;
    commission_amount?: number;
    status?: string;
  }) {
    const response = await fetch('/api/admin/referrals', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update referral');
    }

    return response.json();
  }

  // Get commission summary
  async getCommissionSummary(params: {
    affiliate_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.affiliate_id) searchParams.append('affiliate_id', params.affiliate_id);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.status) searchParams.append('status', params.status);

    const response = await fetch(`/api/admin/commissions?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch commission summary');
    }
    
    return response.json();
  }

  // Calculate commissions for a specific period
  async calculateCommissions(data: {
    start_date: string;
    end_date: string;
    affiliate_id?: string;
  }) {
    const response = await fetch('/api/admin/commissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to calculate commissions');
    }

    return response.json();
  }

  // Process payout for an affiliate
  async processPayout(data: {
    affiliate_id: string;
    amount: number;
    payment_method: string;
    notes?: string;
  }) {
    const response = await fetch('/api/admin/commissions', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process payout');
    }

    return response.json();
  }

  // Track a referral during signup
  async trackReferral(data: {
    referral_code: string;
    user_id: string;
    subscription_amount?: number;
  }) {
    const response = await fetch('/api/referral-track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to track referral');
    }

    return response.json();
  }

  // Generate a unique referral code
  generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Validate referral code format
  validateReferralCode(code: string): boolean {
    return /^[A-Z0-9]{8}$/.test(code);
  }

  // Calculate commission amount
  calculateCommission(subscriptionAmount: number, commissionRate: number): number {
    return (subscriptionAmount * commissionRate) / 100;
  }
}

export const affiliateService = new AffiliateService(); 