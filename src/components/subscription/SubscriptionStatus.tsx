import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SubscriptionStatus: React.FC = () => {
  const { 
    isLoading, 
    subscription, 
    isSubscriptionValid, 
    isDeveloper,
    isTrialActive,
    daysLeftInTrial
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse h-6 w-24 bg-muted rounded"></div>
    );
  }

  if (isDeveloper) {
    return (
      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Developer
        </span>
      </Badge>
    );
  }

  if (!subscription) {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link to="/subscription">Subscribe</Link>
      </Button>
    );
  }

  if (isTrialActive) {
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Trial: {daysLeftInTrial} {daysLeftInTrial === 1 ? 'day' : 'days'} left
        </span>
      </Badge>
    );
  }

  if (subscription.status === 'active') {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {subscription.plan?.name || 'Active'}
        </span>
      </Badge>
    );
  }

  return (
    <Button size="sm" variant="outline" className="text-red-600 border-red-300" asChild>
      <Link to="/subscription" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Subscription Required
      </Link>
    </Button>
  );
}; 