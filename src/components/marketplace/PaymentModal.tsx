import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Shield, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { MarketplaceService } from '@/services/marketplaceService';
import { useToast } from '@/components/ui/use-toast';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    product_type: string;
    seller_id: string;
  };
  onSuccess?: (order: any) => void;
}

export default function PaymentModal({ isOpen, onClose, product, onSuccess }: PaymentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'review' | 'payment' | 'success'>('review');
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('review');
      setOrder(null);
    }
  }, [isOpen]);

  const handlePurchase = async () => {
    try {
      setLoading(true);
      setStep('payment');

      // Calculate platform fee and seller payout
      const { platformFee, sellerPayout } = MarketplaceService.calculatePlatformFee(product.price);
      
      // Create order
      const orderData = {
        buyer_id: '', // This would come from auth context
        seller_id: product.seller_id,
        product_type: product.product_type,
        product_id: product.id,
        order_type: 'one_time',
        amount: product.price,
        currency: 'USD',
        platform_fee: platformFee,
        seller_payout: sellerPayout,
        status: 'pending'
      };

      const newOrder = await MarketplaceService.createOrder(orderData);
      setOrder(newOrder);

      // In a real implementation, you would integrate with Stripe here
      // For now, we'll simulate a successful payment
      setTimeout(() => {
        setStep('success');
        setLoading(false);
        
        toast({
          title: 'Purchase Successful',
          description: 'Your order has been processed successfully!',
        });
        
        onSuccess?.(newOrder);
      }, 2000);

    } catch (error: any) {
      console.error('Error processing purchase:', error);
      setStep('review');
      setLoading(false);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to process purchase',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onClose();
    } else {
      onClose();
    }
  };

  const getProductIcon = (type: string) => {
    switch (type) {
      case 'guide': return '📚';
      case 'template': return '📋';
      case 'script': return '⚙️';
      case 'indicator': return '📊';
      case 'strategy': return '🎯';
      default: return '📦';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Complete Purchase</span>
          </DialogTitle>
          <DialogDescription>
            Review your order and complete the payment
          </DialogDescription>
        </DialogHeader>

        {step === 'review' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <span>{getProductIcon(product.product_type)}</span>
                  <span>{product.title}</span>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {product.product_type}
                  </Badge>
                  <div className="text-2xl font-bold text-green-600">
                    ${product.price.toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Product Price</span>
                <span>${product.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Platform Fee (10%)</span>
                <span>${(product.price * 0.1).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${product.price.toFixed(2)}</span>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Disclaimer:</strong> This product is for informational purposes only and does not constitute investment advice. 
                Past performance does not guarantee future results.
              </AlertDescription>
            </Alert>

            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handlePurchase} className="flex-1">
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
              <p className="text-gray-600">Please wait while we process your payment...</p>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Your payment is secured with 256-bit SSL encryption</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Instant access after successful payment</span>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Purchase Successful!</h3>
              <p className="text-gray-600">
                Your order has been processed and you now have access to this product.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Order Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Order ID:</span>
                  <span className="font-mono">{order?.id?.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Product:</span>
                  <span>{product.title}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span>${product.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="default" className="text-xs">Delivered</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
              <Download className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Download links have been sent to your email
              </span>
            </div>

            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
