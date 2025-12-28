/**
 * Strategy Marketplace Component
 * QuantConnect-style marketplace for buying and selling strategies
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Star, 
  TrendingUp, 
  Users, 
  DollarSign,
  Eye,
  Download,
  Heart,
  Share2,
  MoreVertical,
  Code,
  BarChart3,
  Clock,
  Shield,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface StrategyListing {
  id: string;
  strategyId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  tags: string[];
  isFeatured: boolean;
  isVerified: boolean;
  performanceScore: number;
  totalSales: number;
  totalRevenue: number;
  ratingAverage: number;
  ratingCount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    verified: boolean;
    totalSales: number;
    rating: number;
  };
  strategy: {
    id: string;
    name: string;
    language: 'python' | 'csharp';
    category: string;
    tags: string[];
  };
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    backtestPeriod: string;
  };
}

interface MarketplaceFilters {
  search: string;
  category: string;
  priceRange: [number, number];
  performanceScore: number;
  rating: number;
  tags: string[];
  sortBy: 'relevance' | 'price' | 'performance' | 'rating' | 'sales' | 'newest';
  sortOrder: 'asc' | 'desc';
}

const CATEGORIES = [
  'All',
  'Trend Following',
  'Mean Reversion',
  'Momentum',
  'Arbitrage',
  'Market Making',
  'Machine Learning',
  'Options',
  'Futures',
  'Crypto',
  'Forex',
  'Stocks'
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price', label: 'Price' },
  { value: 'performance', label: 'Performance Score' },
  { value: 'rating', label: 'Rating' },
  { value: 'sales', label: 'Total Sales' },
  { value: 'newest', label: 'Newest' }
];

export const StrategyMarketplace: React.FC = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<StrategyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MarketplaceFilters>({
    search: '',
    category: 'All',
    priceRange: [0, 10000],
    performanceScore: 0,
    rating: 0,
    tags: [],
    sortBy: 'relevance',
    sortOrder: 'desc'
  });
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedListing, setSelectedListing] = useState<StrategyListing | null>(null);

  // Load marketplace listings
  useEffect(() => {
    loadListings();
  }, [filters]);

  const loadListings = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        search: filters.search,
        category: filters.category,
        minPrice: filters.priceRange[0].toString(),
        maxPrice: filters.priceRange[1].toString(),
        minPerformanceScore: filters.performanceScore.toString(),
        minRating: filters.rating.toString(),
        tags: filters.tags.join(','),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      const response = await fetch(`/api/marketplace/listings?${queryParams}`);
      const data = await response.json();
      setListings(data.listings || []);
    } catch (error) {
      console.error('Failed to load listings:', error);
      toast.error('Failed to load marketplace listings');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (listingId: string) => {
    if (!user) {
      toast.error('Please sign in to purchase strategies');
      return;
    }

    try {
      const response = await fetch(`/api/marketplace/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        throw new Error('Purchase failed');
      }

      const result = await response.json();
      toast.success('Strategy purchased successfully!');
      
      // Update listing sales count
      setListings(prev => prev.map(listing => 
        listing.id === listingId 
          ? { ...listing, totalSales: listing.totalSales + 1 }
          : listing
      ));
    } catch (error) {
      toast.error('Failed to purchase strategy');
    }
  };

  const handleWishlist = async (listingId: string) => {
    if (!user) {
      toast.error('Please sign in to add to wishlist');
      return;
    }

    try {
      const response = await fetch(`/api/marketplace/wishlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        throw new Error('Wishlist operation failed');
      }

      toast.success('Added to wishlist');
    } catch (error) {
      toast.error('Failed to update wishlist');
    }
  };

  const handleShare = async (listingId: string) => {
    try {
      const response = await fetch(`/api/marketplace/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        throw new Error('Share failed');
      }

      const { shareUrl } = await response.json();
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
    } catch (error) {
      toast.error('Failed to create share link');
    }
  };

  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      // Search filter
      if (filters.search && !listing.title.toLowerCase().includes(filters.search.toLowerCase()) &&
          !listing.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Category filter
      if (filters.category !== 'All' && listing.category !== filters.category) {
        return false;
      }

      // Price range filter
      if (listing.price < filters.priceRange[0] || listing.price > filters.priceRange[1]) {
        return false;
      }

      // Performance score filter
      if (listing.performanceScore < filters.performanceScore) {
        return false;
      }

      // Rating filter
      if (listing.ratingAverage < filters.rating) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0 && !filters.tags.some(tag => listing.tags.includes(tag))) {
        return false;
      }

      return true;
    });
  }, [listings, filters]);

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Poor';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Strategy Marketplace</h1>
            <p className="text-muted-foreground">
              Discover, buy, and sell algorithmic trading strategies
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Code className="h-4 w-4 mr-2" />
              Sell Strategy
            </Button>
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search strategies..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10"
            />
          </div>
          <Select
            value={filters.category}
            onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sortBy}
            onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as any }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="my-purchases">My Purchases</TabsTrigger>
          </TabsList>
          
          <TabsContent value="browse" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-4 bg-muted rounded mb-2" />
                        <div className="h-3 bg-muted rounded mb-4" />
                        <div className="h-8 bg-muted rounded" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredListings.map((listing) => (
                    <Card
                      key={listing.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedListing(listing)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg line-clamp-1">
                              {listing.title}
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="secondary">{listing.category}</Badge>
                              {listing.isVerified && (
                                <Badge variant="default" className="bg-blue-100 text-blue-800">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                              {listing.isFeatured && (
                                <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                                  <Award className="h-3 w-3 mr-1" />
                                  Featured
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWishlist(listing.id);
                              }}
                            >
                              <Heart className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare(listing.id);
                              }}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {listing.description}
                        </p>
                        
                        {/* Performance Metrics */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Performance Score</span>
                            <span className={`font-semibold ${getPerformanceColor(listing.performanceScore)}`}>
                              {listing.performanceScore}/100
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total Return</span>
                            <span className="font-semibold">
                              {(listing.metrics.totalReturn * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                            <span className="font-semibold">
                              {listing.metrics.sharpeRatio.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Author Info */}
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold">
                              {listing.author.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-sm font-medium">{listing.author.name}</span>
                              {listing.author.verified && (
                                <Shield className="h-3 w-3 text-blue-500" />
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <span>{listing.author.totalSales} sales</span>
                              <span>•</span>
                              <div className="flex items-center">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{listing.author.rating.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Price and Actions */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-2xl font-bold">
                              ${listing.price.toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1">
                              {listing.currency}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePurchase(listing.id);
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Buy
                            </Button>
                          </div>
                        </div>
                        
                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                          <div className="flex items-center space-x-1">
                            <Eye className="h-3 w-3" />
                            <span>{Math.floor(Math.random() * 1000)} views</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Download className="h-3 w-3" />
                            <span>{listing.totalSales} sales</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{listing.ratingAverage.toFixed(1)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="featured" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Featured Strategies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings.filter(listing => listing.isFeatured).map((listing) => (
                  <Card key={listing.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    {/* Similar card structure as above */}
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="trending" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Trending Strategies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings
                  .sort((a, b) => b.totalSales - a.totalSales)
                  .slice(0, 12)
                  .map((listing) => (
                    <Card key={listing.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                      {/* Similar card structure as above */}
                    </Card>
                  ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="my-purchases" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">My Purchases</h3>
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4" />
                <p>No purchases yet. Start exploring the marketplace!</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StrategyMarketplace;
