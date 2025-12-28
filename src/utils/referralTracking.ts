import { supabase } from '@/lib/supabase';

// Track referral when user signs up
export async function trackReferral(userId: string, referralCode?: string) {
  if (!referralCode) return null;

  try {
    // Get affiliate by referral code
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('referral_code', referralCode)
      .eq('status', 'active')
      .single();

    if (affiliateError || !affiliate) {
      console.log('No active affiliate found for referral code:', referralCode);
      return null;
    }

    // Check if referral already exists
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('user_id', userId)
      .eq('affiliate_id', affiliate.id)
      .single();

    if (existingReferral) {
      console.log('Referral already exists for this user');
      return existingReferral;
    }

    // Create referral record
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .insert([{
        affiliate_id: affiliate.id,
        user_id: userId,
        status: 'active',
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (referralError) {
      console.error('Error creating referral record:', referralError);
      return null;
    }

    console.log('Referral tracked successfully:', referral);
    return referral;
  } catch (error) {
    console.error('Error tracking referral:', error);
    return null;
  }
}

// Get referral code from URL
export function getReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('ref');
}

// Store referral code in localStorage for later use
export function storeReferralCode(referralCode: string) {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('referral_code', referralCode);
}

// Get stored referral code
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  
  return localStorage.getItem('referral_code');
}

// Clear stored referral code
export function clearStoredReferralCode() {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('referral_code');
}
