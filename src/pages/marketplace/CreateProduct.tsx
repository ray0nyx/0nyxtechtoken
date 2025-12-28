import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Plus, AlertTriangle, DollarSign, FileText, Code, BarChart3 } from 'lucide-react';
import { MarketplaceService } from '@/services/marketplaceService';
import { useToast } from '@/components/ui/use-toast';

export default function CreateProduct() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [productType, setProductType] = useState<'guide' | 'template' | 'script' | 'indicator' | 'strategy'>('guide');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    short_description: '',
    category_id: '',
    price: '',
    tags: [] as string[],
    file_urls: [] as string[],
    preview_images: [] as string[],
    requirements: '',
    installation_instructions: '',
    support_info: '',
    risk_warning: '',
    disclaimer: ''
  });
  const [newTag, setNewTag] = useState('');
  const [performanceData, setPerformanceData] = useState({
    win_rate: '',
    max_drawdown: '',
    sharpe_ratio: '',
    total_return: '',
    volatility: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await MarketplaceService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleFileUpload = async (files: FileList, type: 'files' | 'images') => {
    // In a real implementation, you would upload files to a storage service
    // For now, we'll simulate file URLs
    const fileUrls = Array.from(files).map(file => URL.createObjectURL(file));
    
    if (type === 'files') {
      setFormData(prev => ({
        ...prev,
        file_urls: [...prev.file_urls, ...fileUrls]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        preview_images: [...prev.preview_images, ...fileUrls]
      }));
    }
  };

  const removeFile = (index: number, type: 'files' | 'images') => {
    if (type === 'files') {
      setFormData(prev => ({
        ...prev,
        file_urls: prev.file_urls.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        preview_images: prev.preview_images.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.price) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const productData = {
        ...formData,
        product_type: productType,
        price: parseFloat(formData.price),
        performance_data: performanceData,
        historical_performance: performanceData, // In real app, this would be different
        status: 'draft'
      };

      await MarketplaceService.createProduct(productData);
      
      toast({
        title: 'Success',
        description: 'Product created successfully! It will be reviewed before going live.',
      });
      
      navigate('/marketplace');
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create product',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getProductTypeIcon = (type: string) => {
    switch (type) {
      case 'guide': return <FileText className="h-4 w-4" />;
      case 'script': return <Code className="h-4 w-4" />;
      case 'indicator': return <BarChart3 className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Product</h1>
        <p className="text-gray-600">Share your trading knowledge and tools with the community</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="legal">Legal</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>Basic details about your product</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="productType">Product Type *</Label>
                    <Select value={productType} onValueChange={(value: any) => setProductType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guide">
                          <div className="flex items-center space-x-2">
                            {getProductTypeIcon('guide')}
                            <span>Guide</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="template">
                          <div className="flex items-center space-x-2">
                            {getProductTypeIcon('template')}
                            <span>Template</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="script">
                          <div className="flex items-center space-x-2">
                            {getProductTypeIcon('script')}
                            <span>Script</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="indicator">
                          <div className="flex items-center space-x-2">
                            {getProductTypeIcon('indicator')}
                            <span>Indicator</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="strategy">
                          <div className="flex items-center space-x-2">
                            {getProductTypeIcon('strategy')}
                            <span>Strategy</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category_id} onValueChange={(value) => handleInputChange('category_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter product title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="shortDescription">Short Description</Label>
                  <Input
                    id="shortDescription"
                    value={formData.short_description}
                    onChange={(e) => handleInputChange('short_description', e.target.value)}
                    placeholder="Brief description for product cards"
                  />
                </div>

                <div>
                  <Label htmlFor="price">Price (USD) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      placeholder="0.00"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="tags">Tags</Label>
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add a tag"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                          <span>{tag}</span>
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content & Files</CardTitle>
                <CardDescription>Upload your product files and provide detailed information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description of your product"
                    rows={6}
                    required
                  />
                </div>

                <div>
                  <Label>Product Files</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload your product files</p>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'files')}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button type="button" variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                      Choose Files
                    </Button>
                  </div>
                  {formData.file_urls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.file_urls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm">{url}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index, 'files')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Preview Images</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload preview images</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'images')}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()}>
                      Choose Images
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    value={formData.requirements}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    placeholder="System requirements, dependencies, etc."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="installation">Installation Instructions</Label>
                  <Textarea
                    id="installation"
                    value={formData.installation_instructions}
                    onChange={(e) => handleInputChange('installation_instructions', e.target.value)}
                    placeholder="Step-by-step installation guide"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="support">Support Information</Label>
                  <Textarea
                    id="support"
                    value={formData.support_info}
                    onChange={(e) => handleInputChange('support_info', e.target.value)}
                    placeholder="How users can get support"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Data</CardTitle>
                <CardDescription>Share historical performance metrics (optional but recommended)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Performance data is for informational purposes only and does not guarantee future results.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="winRate">Win Rate (%)</Label>
                    <Input
                      id="winRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={performanceData.win_rate}
                      onChange={(e) => setPerformanceData(prev => ({ ...prev, win_rate: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxDrawdown">Max Drawdown (%)</Label>
                    <Input
                      id="maxDrawdown"
                      type="number"
                      step="0.01"
                      min="0"
                      value={performanceData.max_drawdown}
                      onChange={(e) => setPerformanceData(prev => ({ ...prev, max_drawdown: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sharpeRatio">Sharpe Ratio</Label>
                    <Input
                      id="sharpeRatio"
                      type="number"
                      step="0.01"
                      value={performanceData.sharpe_ratio}
                      onChange={(e) => setPerformanceData(prev => ({ ...prev, sharpe_ratio: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="totalReturn">Total Return (%)</Label>
                    <Input
                      id="totalReturn"
                      type="number"
                      step="0.01"
                      value={performanceData.total_return}
                      onChange={(e) => setPerformanceData(prev => ({ ...prev, total_return: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="volatility">Volatility (%)</Label>
                    <Input
                      id="volatility"
                      type="number"
                      step="0.01"
                      min="0"
                      value={performanceData.volatility}
                      onChange={(e) => setPerformanceData(prev => ({ ...prev, volatility: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="legal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Legal & Disclaimers</CardTitle>
                <CardDescription>Important legal information and disclaimers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="riskWarning">Risk Warning</Label>
                  <Textarea
                    id="riskWarning"
                    value={formData.risk_warning}
                    onChange={(e) => handleInputChange('risk_warning', e.target.value)}
                    placeholder="Specific risk warnings for your product"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="disclaimer">Additional Disclaimer</Label>
                  <Textarea
                    id="disclaimer"
                    value={formData.disclaimer}
                    onChange={(e) => handleInputChange('disclaimer', e.target.value)}
                    placeholder="Any additional disclaimers or terms"
                    rows={4}
                  />
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Default Disclaimer:</strong> This product is for informational purposes only and does not constitute investment advice. 
                    Past performance does not guarantee future results. Trading involves substantial risk of loss and may not be suitable for all investors.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-4 mt-8">
          <Button type="button" variant="outline" onClick={() => navigate('/marketplace')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
