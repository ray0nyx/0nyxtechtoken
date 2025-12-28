import { supabase } from '@/lib/supabase';

export interface MarketplaceProduct {
  id: string;
  seller_id: string;
  category_id?: string;
  title: string;
  description: string;
  short_description?: string;
  product_type: 'guide' | 'template' | 'script' | 'indicator' | 'strategy';
  price: number;
  currency: string;
  is_digital: boolean;
  file_urls: string[];
  preview_images: string[];
  tags: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
  performance_data: any;
  historical_performance: any;
  risk_warning?: string;
  disclaimer?: string;
  requirements?: string;
  installation_instructions?: string;
  support_info?: string;
  download_count: number;
  rating_average: number;
  rating_count: number;
  view_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignalBroadcast {
  id: string;
  provider_id: string;
  symbol: string;
  signal_type: 'buy' | 'sell' | 'hold' | 'alert';
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  timeframe?: string;
  reasoning?: string;
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  confidence_score: number;
  tags: string[];
  is_public: boolean;
  expires_at?: string;
  created_at: string;
}

export interface AlgorithmListing {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  programming_language: string;
  framework?: string;
  price: number;
  currency: string;
  license_type: 'single_use' | 'commercial' | 'enterprise' | 'open_source';
  file_urls: string[];
  documentation_url?: string;
  github_url?: string;
  requirements: any;
  performance_metrics: any;
  backtest_results: any;
  risk_metrics: any;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
  download_count: number;
  rating_average: number;
  rating_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_type: string;
  product_id: string;
  order_type: 'one_time' | 'subscription' | 'license';
  amount: number;
  currency: string;
  platform_fee: number;
  seller_payout: number;
  status: 'pending' | 'paid' | 'delivered' | 'cancelled' | 'refunded';
  payment_intent_id?: string;
  stripe_session_id?: string;
  download_urls: string[];
  license_key?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export class MarketplaceService {
  // Product Management
  static async createProduct(productData: Partial<MarketplaceProduct>) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .insert([productData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateProduct(productId: string, updates: Partial<MarketplaceProduct>) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getProducts(filters: {
    category_id?: string;
    product_type?: string;
    status?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = supabase
      .from('marketplace_products')
      .select(`
        *,
        marketplace_categories(name, icon),
        auth.users!marketplace_products_seller_id_fkey(email, user_metadata)
      `)
      .eq('status', 'approved');

    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    if (filters.product_type) {
      query = query.eq('product_type', filters.product_type);
    }

    if (filters.featured) {
      query = query.eq('is_featured', true);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getProduct(productId: string) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .select(`
        *,
        marketplace_categories(name, icon),
        auth.users!marketplace_products_seller_id_fkey(email, user_metadata)
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;
    return data;
  }

  static async incrementViewCount(productId: string) {
    const { error } = await supabase.rpc('increment_view_count', {
      product_id: productId
    });

    if (error) throw error;
  }

  // Signal Management
  static async createSignal(signalData: Partial<SignalBroadcast>) {
    const { data, error } = await supabase
      .from('signal_broadcasts')
      .insert([signalData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getSignals(filters: {
    provider_id?: string;
    symbol?: string;
    signal_type?: string;
    limit?: number;
  } = {}) {
    let query = supabase
      .from('signal_broadcasts')
      .select(`
        *,
        auth.users!signal_broadcasts_provider_id_fkey(email, user_metadata)
      `)
      .order('created_at', { ascending: false });

    if (filters.provider_id) {
      query = query.eq('provider_id', filters.provider_id);
    }

    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }

    if (filters.signal_type) {
      query = query.eq('signal_type', filters.signal_type);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  static async subscribeToSignals(providerId: string, subscriptionType: string, price: number) {
    const { data, error } = await supabase
      .from('signal_subscriptions')
      .insert([{
        signal_provider_id: providerId,
        subscription_type: subscriptionType,
        price: price,
        expires_at: subscriptionType === 'monthly' 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : subscriptionType === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Algorithm Management
  static async createAlgorithm(algorithmData: Partial<AlgorithmListing>) {
    const { data, error } = await supabase
      .from('algorithm_listings')
      .insert([algorithmData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getAlgorithms(filters: {
    programming_language?: string;
    license_type?: string;
    status?: string;
    featured?: boolean;
    limit?: number;
  } = {}) {
    let query = supabase
      .from('algorithm_listings')
      .select(`
        *,
        auth.users!algorithm_listings_seller_id_fkey(email, user_metadata)
      `)
      .eq('status', 'approved');

    if (filters.programming_language) {
      query = query.eq('programming_language', filters.programming_language);
    }

    if (filters.license_type) {
      query = query.eq('license_type', filters.license_type);
    }

    if (filters.featured) {
      query = query.eq('is_featured', true);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Order Management
  static async createOrder(orderData: Partial<MarketplaceOrder>) {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .insert([orderData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getOrders(userId: string, orderType: 'buyer' | 'seller' = 'buyer') {
    const column = orderType === 'buyer' ? 'buyer_id' : 'seller_id';
    
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select(`
        *,
        marketplace_products(title, product_type),
        algorithm_listings(name, programming_language)
      `)
      .eq(column, userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async updateOrderStatus(orderId: string, status: string) {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Review Management
  static async createReview(reviewData: {
    product_id: string;
    product_type: string;
    rating: number;
    title?: string;
    review_text?: string;
    pros?: string[];
    cons?: string[];
  }) {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .insert([reviewData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getReviews(productId: string) {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .select(`
        *,
        auth.users!marketplace_reviews_buyer_id_fkey(email, user_metadata)
      `)
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Analytics
  static async getSellerAnalytics(sellerId: string, dateRange: { start: string; end: string }) {
    const { data, error } = await supabase
      .from('marketplace_analytics')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true });

    if (error) throw error;
    return data;
  }

  // Categories
  static async getCategories() {
    const { data, error } = await supabase
      .from('marketplace_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  // Disclaimers
  static async getDisclaimers(productType: string) {
    const { data, error } = await supabase
      .from('marketplace_disclaimers')
      .select('*')
      .eq('product_type', productType)
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data[0];
  }

  // Platform fee calculation
  static calculatePlatformFee(amount: number): { platformFee: number; sellerPayout: number } {
    const platformFeeRate = 0.10; // 10% platform fee
    const platformFee = amount * platformFeeRate;
    const sellerPayout = amount - platformFee;
    
    return { platformFee, sellerPayout };
  }

  // Generate license key
  static generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
