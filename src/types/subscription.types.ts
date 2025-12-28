export type SubscriptionStatus = 'active' | 'canceled' | 'expired';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: {
    features: string[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_method_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_developer: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  plan?: SubscriptionPlan;
}

export interface SubscriptionInvoice {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  stripe_invoice_id: string | null;
  invoice_date: string;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
} 