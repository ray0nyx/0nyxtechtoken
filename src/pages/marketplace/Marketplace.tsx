import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Star, Download, Eye, DollarSign, Code, BookOpen, BarChart3, Bell } from 'lucide-react';
import { MarketplaceService, MarketplaceProduct, AlgorithmListing, SignalBroadcast } from '@/services/marketplaceService';
import { useToast } from '@/components/ui/use-toast';

export default function Marketplace() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [algorithms, setAlgorithms] = useState<AlgorithmListing[]>([]);
  const [signals, setSignals] = useState<SignalBroadcast[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, algorithmsData, signalsData, categoriesData] = await Promise.all([
        MarketplaceService.getProducts({ limit: 20 }),
        MarketplaceService.getAlgorithms({ limit: 20 }),
        MarketplaceService.getSignals({ limit: 20 }),
        MarketplaceService.getCategories()
      ]);

      setProducts(productsData);
      setAlgorithms(algorithmsData);
      setSignals(signalsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load marketplace data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    const matchesType = selectedType === 'all' || product.product_type === selectedType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const ProductCard = ({ product }: { product: MarketplaceProduct }) => (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{product.title}</CardTitle>
            <CardDescription className="mt-1">{product.short_description}</CardDescription>
          </div>
          <Badge variant="secondary" className="ml-2">
            {product.product_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{product.rating_average.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({product.rating_count})</span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Eye className="h-4 w-4" />
                <span>{product.view_count}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Download className="h-4 w-4" />
                <span>{product.download_count}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-green-600">
              ${product.price.toFixed(2)}
            </div>
            <Button size="sm">
              View Details
            </Button>
          </div>
          
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const AlgorithmCard = ({ algorithm }: { algorithm: AlgorithmListing }) => (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{algorithm.name}</CardTitle>
            <CardDescription className="mt-1">{algorithm.description}</CardDescription>
          </div>
          <Badge variant="secondary" className="ml-2">
            {algorithm.programming_language}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{algorithm.rating_average.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({algorithm.rating_count})</span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Download className="h-4 w-4" />
                <span>{algorithm.download_count}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-green-600">
              ${algorithm.price.toFixed(2)}
            </div>
            <Button size="sm">
              View Details
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Code className="h-4 w-4" />
            <span>{algorithm.framework || 'No framework'}</span>
            <Badge variant="outline" className="text-xs">
              {algorithm.license_type}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SignalCard = ({ signal }: { signal: SignalBroadcast }) => (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{signal.symbol}</CardTitle>
            <CardDescription className="mt-1">
              {signal.signal_type.toUpperCase()} Signal
            </CardDescription>
          </div>
          <Badge 
            variant={signal.signal_type === 'buy' ? 'default' : signal.signal_type === 'sell' ? 'destructive' : 'secondary'}
            className="ml-2"
          >
            {signal.signal_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {signal.entry_price && (
              <div>
                <span className="text-gray-500">Entry:</span>
                <span className="ml-1 font-medium">${signal.entry_price}</span>
              </div>
            )}
            {signal.stop_loss && (
              <div>
                <span className="text-gray-500">Stop Loss:</span>
                <span className="ml-1 font-medium">${signal.stop_loss}</span>
              </div>
            )}
            {signal.take_profit && (
              <div>
                <span className="text-gray-500">Take Profit:</span>
                <span className="ml-1 font-medium">${signal.take_profit}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Confidence:</span>
              <span className="ml-1 font-medium">{signal.confidence_score}/10</span>
            </div>
          </div>
          
          {signal.reasoning && (
            <p className="text-sm text-gray-600">{signal.reasoning}</p>
          )}
          
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {signal.risk_level} Risk
            </Badge>
            <Button size="sm" variant="outline">
              Subscribe
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-magenta-500 to-blue-500">
          Trading Marketplace
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Discover trading guides, indicators, signals, and algorithms from expert traders
        </p>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search products, signals, or algorithms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="guide">Guides</SelectItem>
              <SelectItem value="indicator">Indicators</SelectItem>
              <SelectItem value="template">Templates</SelectItem>
              <SelectItem value="script">Scripts</SelectItem>
              <SelectItem value="strategy">Strategies</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4" />
            <span>Products</span>
          </TabsTrigger>
          <TabsTrigger value="algorithms" className="flex items-center space-x-2">
            <Code className="h-4 w-4" />
            <span>Algorithms</span>
          </TabsTrigger>
          <TabsTrigger value="signals" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Signals</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="algorithms" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {algorithms.map((algorithm) => (
              <AlgorithmCard key={algorithm.id} algorithm={algorithm} />
            ))}
          </div>
          {algorithms.length === 0 && (
            <div className="text-center py-12">
              <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No algorithms found</h3>
              <p className="text-gray-500">Check back later for new algorithm listings</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="signals" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
          {signals.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No signals found</h3>
              <p className="text-gray-500">Subscribe to signal providers to see their broadcasts</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Legal Disclaimer */}
      <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Important Disclaimer</h3>
        <p className="text-yellow-700 text-sm">
          All products, signals, and algorithms are for informational purposes only and do not constitute investment advice. 
          Past performance does not guarantee future results. Trading involves substantial risk of loss and may not be suitable for all investors. 
          You are responsible for your own trading decisions and should carefully consider your investment objectives, level of experience, and risk appetite.
        </p>
      </div>
    </div>
  );
}
