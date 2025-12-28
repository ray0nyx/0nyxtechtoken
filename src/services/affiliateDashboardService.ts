export interface AffiliateDashboardData {
  affiliate: {
    id: string;
    name: string;
    email: string;
    status: string;
    referral_code: string;
    commission_rate: number;
    date_applied: string;
  };
  referrals: Array<{
    id: string;
    user_id: string;
    commission_amount: number;
    status: string;
    date: string;
    users: {
      id: string;
      email: string;
      created_at: string;
    };
  }>;
  earningsSummary: {
    totalEarnings: number;
    pendingEarnings: number;
    paidEarnings: number;
    totalReferrals: number;
    activeReferrals: number;
  };
}

class AffiliateDashboardService {
  // Get affiliate dashboard data
  async getDashboardData(): Promise<AffiliateDashboardData> {
    const response = await fetch('/api/affiliate/dashboard');
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Affiliate not found or not active');
      }
      throw new Error('Failed to fetch dashboard data');
    }
    
    return response.json();
  }

  // Generate affiliate link
  generateAffiliateLink(referralCode: string): string {
    return `${window.location.origin}/signup?ref=${referralCode}`;
  }

  // Copy affiliate link to clipboard
  async copyAffiliateLink(referralCode: string): Promise<boolean> {
    const affiliateLink = this.generateAffiliateLink(referralCode);
    
    try {
      await navigator.clipboard.writeText(affiliateLink);
      return true;
    } catch (error) {
      console.error('Failed to copy affiliate link:', error);
      return false;
    }
  }

  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  // Calculate earnings statistics
  calculateEarningsStats(referrals: AffiliateDashboardData['referrals']) {
    const totalEarnings = referrals.reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
    const pendingEarnings = referrals
      .filter(ref => ref.status === 'pending')
      .reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
    const paidEarnings = referrals
      .filter(ref => ref.status === 'paid')
      .reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(ref => ref.status === 'pending').length;
    const averagePerReferral = totalReferrals > 0 ? totalEarnings / totalReferrals : 0;

    return {
      totalEarnings,
      pendingEarnings,
      paidEarnings,
      totalReferrals,
      activeReferrals,
      averagePerReferral
    };
  }

  // Get recent referrals (last 5)
  getRecentReferrals(referrals: AffiliateDashboardData['referrals'], limit: number = 5) {
    return referrals.slice(0, limit);
  }

  // Get referrals by status
  getReferralsByStatus(referrals: AffiliateDashboardData['referrals'], status: string) {
    return referrals.filter(ref => ref.status === status);
  }

  // Get monthly earnings
  getMonthlyEarnings(referrals: AffiliateDashboardData['referrals']) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return referrals
      .filter(ref => new Date(ref.date) >= startOfMonth)
      .reduce((sum, ref) => sum + Number(ref.commission_amount), 0);
  }

  // Validate affiliate status
  validateAffiliateStatus(status: string): boolean {
    return status === 'active';
  }

  // Get status badge color
  getStatusBadgeColor(status: string): string {
    const colors = {
      active: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      inactive: "bg-red-100 text-red-800",
      paid: "bg-blue-100 text-blue-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  }
}

export const affiliateDashboardService = new AffiliateDashboardService(); 