import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { isSubscriptionValid, isLoading, isDeveloper } = useSubscription();
  const location = useLocation();

  // Show loading while checking subscription
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-magenta-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking subscription...</p>
        </div>
      </div>
    );
  }

  // Allow access for developers or users with valid subscriptions
  if (isDeveloper || isSubscriptionValid) {
    return <>{children}</>;
  }

  // Redirect to pricing page for users without valid subscriptions
  return (
    <Navigate 
      to="/pricing" 
      state={{ 
        fromDashboard: true,
        message: "Please subscribe to access the dashboard"
      }} 
      replace 
    />
  );
};

export default SubscriptionGuard;
