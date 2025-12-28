import { supabase } from '@/lib/supabase';

// Stripe Connect payout service for affiliates
export class StripePayoutService {
  private stripe: any;

  constructor() {
    // Initialize Stripe with your secret key
    this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }

  // Create a Stripe Connect account for an affiliate
  async createConnectAccount(affiliateId: string, email: string, country: string = 'US') {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: country,
        email: email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
          email: email,
        },
      });

      // Store the Stripe Connect account ID in the database
      const { error } = await supabase
        .from('affiliate_stripe_accounts')
        .upsert({
          affiliate_id: affiliateId,
          stripe_account_id: account.id,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error storing Stripe account:', error);
        throw error;
      }

      return {
        accountId: account.id,
        accountLink: await this.createAccountLink(account.id),
      };
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  // Create account link for onboarding
  async createAccountLink(accountId: string) {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/affiliate/dashboard?refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/affiliate/dashboard?success=true`,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      console.error('Error creating account link:', error);
      throw error;
    }
  }

  // Check if affiliate has completed Stripe Connect onboarding
  async isAccountReady(affiliateId: string): Promise<boolean> {
    try {
      const { data: accountData, error } = await supabase
        .from('affiliate_stripe_accounts')
        .select('stripe_account_id, status')
        .eq('affiliate_id', affiliateId)
        .single();

      if (error || !accountData) {
        return false;
      }

      const account = await this.stripe.accounts.retrieve(accountData.stripe_account_id);
      return account.details_submitted && account.charges_enabled;
    } catch (error) {
      console.error('Error checking account status:', error);
      return false;
    }
  }

  // Process a payout to an affiliate
  async processPayout(payoutRequestId: string): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
      // Get payout request details
      const { data: payoutData, error: payoutError } = await supabase
        .from('payouts')
        .select(`
          *,
          affiliate_stripe_accounts!inner(stripe_account_id)
        `)
        .eq('id', payoutRequestId)
        .single();

      if (payoutError || !payoutData) {
        throw new Error('Payout request not found');
      }

      // Get affiliate's Stripe Connect account
      const { data: accountData, error: accountError } = await supabase
        .from('affiliate_stripe_accounts')
        .select('stripe_account_id')
        .eq('affiliate_id', payoutData.affiliate_id)
        .single();

      if (accountError || !accountData) {
        throw new Error('Affiliate Stripe account not found');
      }

      // Create transfer to affiliate's Stripe Connect account
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(payoutData.amount * 100), // Convert to cents
        currency: 'usd',
        destination: accountData.stripe_account_id,
        transfer_group: `payout_${payoutRequestId}`,
        metadata: {
          payout_id: payoutRequestId,
          affiliate_id: payoutData.affiliate_id,
        },
      });

      // Update payout status in database
      const { error: updateError } = await supabase
        .from('payouts')
        .update({
          status: 'processing',
          stripe_transfer_id: transfer.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutRequestId);

      if (updateError) {
        console.error('Error updating payout status:', updateError);
      }

      return {
        success: true,
        transferId: transfer.id,
      };
    } catch (error) {
      console.error('Error processing payout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get payout status from Stripe
  async getPayoutStatus(transferId: string) {
    try {
      const transfer = await this.stripe.transfers.retrieve(transferId);
      return {
        status: transfer.reversed ? 'failed' : 'completed',
        amount: transfer.amount / 100,
        created: transfer.created,
        destination: transfer.destination,
      };
    } catch (error) {
      console.error('Error getting payout status:', error);
      throw error;
    }
  }

  // Create a payout request (called when affiliate requests payout)
  async createPayoutRequest(affiliateId: string, amount: number): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    try {
      // Check if affiliate has Stripe Connect account
      const isReady = await this.isAccountReady(affiliateId);
      if (!isReady) {
        return {
          success: false,
          error: 'Please complete Stripe Connect setup first',
        };
      }

      // Check minimum payout amount
      const { data: settings } = await supabase
        .from('payout_settings')
        .select('minimum_payout_amount')
        .single();

      const minAmount = settings?.minimum_payout_amount || 50;
      if (amount < minAmount) {
        return {
          success: false,
          error: `Minimum payout amount is $${minAmount}`,
        };
      }

      // Create payout request
      const { data: payoutData, error: payoutError } = await supabase
        .from('payouts')
        .insert({
          affiliate_id: affiliateId,
          amount: amount,
          status: 'pending',
          payment_method: 'stripe_connect',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (payoutError) {
        throw payoutError;
      }

      return {
        success: true,
        payoutId: payoutData.id,
      };
    } catch (error) {
      console.error('Error creating payout request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get affiliate's Stripe Connect dashboard URL
  async getDashboardUrl(affiliateId: string): Promise<string | null> {
    try {
      const { data: accountData, error } = await supabase
        .from('affiliate_stripe_accounts')
        .select('stripe_account_id')
        .eq('affiliate_id', affiliateId)
        .single();

      if (error || !accountData) {
        return null;
      }

      const loginLink = await this.stripe.accounts.createLoginLink(accountData.stripe_account_id);
      return loginLink.url;
    } catch (error) {
      console.error('Error creating dashboard URL:', error);
      return null;
    }
  }
}

export const stripePayoutService = new StripePayoutService();
