import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AffiliateStatus {
  isAffiliate: boolean;
  affiliateData: any;
  loading: boolean;
}

export const useAffiliate = (): AffiliateStatus => {
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affiliateData, setAffiliateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    checkAffiliateStatus();
  }, []);

  const checkAffiliateStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsAffiliate(false);
        setAffiliateData(null);
        setLoading(false);
        return;
      }

      // Check if user is an approved affiliate - try by user_id first
      let { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      // If not found by user_id, try by email
      if (error || !data) {
        const emailResult = await supabase
          .from('affiliates')
          .select('*')
          .eq('email', user.email)
          .eq('status', 'active')
          .single();

        data = emailResult.data;
        error = emailResult.error;
      }

      if (error || !data) {
        // User is not an affiliate
        setIsAffiliate(false);
        setAffiliateData(null);
      } else {
        setIsAffiliate(true);
        setAffiliateData(data);
      }
    } catch (error) {
      console.error('Error checking affiliate status:', error);
      setIsAffiliate(false);
      setAffiliateData(null);
    } finally {
      setLoading(false);
    }
  };

  return { isAffiliate, affiliateData, loading };
};
