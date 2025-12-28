import React, { ReactNode, useEffect, useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Pricing from '@/pages/Pricing';
import { supabase } from '@/lib/supabase';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  // TEMPORARY: Completely bypass subscription validation
  // All authenticated users (who reach this point) get access
  console.log('SubscriptionGuard: Allowing access to all authenticated users');
  console.log('SubscriptionGuard: Current location:', window.location.pathname);
  return <>{children}</>;
}; 