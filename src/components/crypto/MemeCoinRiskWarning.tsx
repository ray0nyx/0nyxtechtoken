import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface MemeCoinRiskWarningProps {
  isOpen: boolean;
  onAcknowledge: () => void;
  onClose?: () => void;
}

export default function MemeCoinRiskWarning({ isOpen, onAcknowledge, onClose }: MemeCoinRiskWarningProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const handleAcknowledge = async () => {
    if (!acknowledged) {
      toast({
        title: 'Acknowledgment Required',
        description: 'Please read and acknowledge the risks before proceeding.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user IP and user agent
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => null);
      
      const userAgent = navigator.userAgent;

      // Store acknowledgment in database
      const { error } = await supabase
        .from('user_risk_acknowledgments')
        .upsert({
          user_id: user.id,
          acknowledgment_type: 'meme_coin_risk',
          ip_address: ipAddress,
          user_agent: userAgent,
          version: '1.0',
        }, {
          onConflict: 'user_id,acknowledgment_type'
        });

      if (error) {
        throw error;
      }

      onAcknowledge();
      toast({
        title: 'Risk Acknowledged',
        description: 'You can now access Coins.',
      });
    } catch (error: any) {
      console.error('Error acknowledging risk:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save acknowledgment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            High-Risk Meme Coin Trading Warning
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Important: Please read this warning carefully before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Critical Warning */}
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-4">
            <h3 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              CRITICAL RISK WARNING
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Trading meme coins involves EXTREMELY HIGH RISK. You may lose your entire investment. 
              Meme coins are highly volatile, speculative assets that can experience rapid price movements 
              in either direction, including complete loss of value.
            </p>
          </div>

          {/* Risk Factors */}
          <div className="space-y-3">
            <h4 className="font-semibold text-lg">Key Risk Factors:</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Extreme Volatility:</strong> Meme coin prices can fluctuate dramatically 
                  within minutes or hours. Price swings of 50% or more in a single day are common.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Potential for Total Loss:</strong> You may lose 100% of your investment. 
                  Meme coins can become worthless overnight.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Liquidity Risk:</strong> Low liquidity can make it difficult or impossible 
                  to sell your tokens at desired prices, especially during market downturns.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Rug Pull Risk:</strong> Some projects may be scams. Developers can abandon 
                  projects, remove liquidity, or engage in fraudulent activities, resulting in total loss.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>No Guarantees:</strong> There is no guarantee of returns. Past performance 
                  does not indicate future results. Many meme coins fail completely.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Regulatory Uncertainty:</strong> Cryptocurrency regulations are evolving. 
                  Changes in regulations could negatively impact meme coin values or trading ability.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Market Manipulation:</strong> Meme coin markets are susceptible to 
                  manipulation, pump-and-dump schemes, and coordinated trading activities.
                </div>
              </div>
            </div>
          </div>

          {/* Not Investment Advice */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Not Investment Advice:</strong> This platform provides information and tools 
              for trading. We do not provide investment advice, recommendations, or endorsements 
              of any cryptocurrency. All trading decisions are your own responsibility.
            </p>
          </div>

          {/* User Responsibility */}
          <div className="space-y-2">
            <h4 className="font-semibold">Your Responsibility:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <li>Only invest what you can afford to lose completely</li>
              <li>Conduct your own research (DYOR - Do Your Own Research)</li>
              <li>Understand the risks before trading</li>
              <li>Never invest based solely on social media hype or recommendations</li>
              <li>Be aware of scams and fraudulent projects</li>
              <li>Consider consulting with a financial advisor</li>
            </ul>
          </div>

          {/* Acknowledgment Checkbox */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600">
            <Checkbox
              id="risk-acknowledgment"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              className="mt-1"
            />
            <label
              htmlFor="risk-acknowledgment"
              className="text-sm font-medium cursor-pointer flex-1"
            >
              I have read, understood, and acknowledge all the risks associated with trading meme coins. 
              I understand that I may lose my entire investment and that this platform does not provide 
              investment advice. I am solely responsible for my trading decisions.
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleAcknowledge}
            disabled={!acknowledged || isSubmitting}
            className={cn(
              "flex-1",
              acknowledged 
                ? "bg-red-600 hover:bg-red-700 text-white" 
                : "bg-gray-400 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              'Processing...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                I Understand the Risks - Proceed
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
