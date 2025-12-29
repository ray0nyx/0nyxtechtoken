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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0b0b0f] border-white/10 text-white p-0">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-white">
              <AlertTriangle className="h-7 w-7 text-yellow-500" />
              High-Risk Meme Coin Trading Warning
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-base pt-1">
              Important: Please read this warning carefully before proceeding.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Critical Warning - Silver Theme */}
            <div className="bg-white/5 border border-white/20 rounded-xl p-5 shadow-2xl backdrop-blur-sm">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                CRITICAL RISK WARNING
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Trading meme coins involves <span className="text-white font-bold">EXTREMELY HIGH RISK</span>. You may lose your entire investment.
                Meme coins are highly volatile, speculative assets that can experience rapid price movements
                in either direction, including complete loss of value.
              </p>
            </div>

            {/* Risk Factors */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-white">Key Risk Factors:</h4>

              <div className="grid gap-3 text-sm">
                {[
                  { title: "Extreme Volatility", desc: "Meme coin prices can fluctuate dramatically within minutes or hours. Price swings of 50% or more in a single day are common." },
                  { title: "Potential for Total Loss", desc: "You may lose 100% of your investment. Meme coins can become worthless overnight." },
                  { title: "Liquidity Risk", desc: "Low liquidity can make it difficult or impossible to sell your tokens at desired prices, especially during market downturns." },
                  { title: "Rug Pull Risk", desc: "Some projects may be scams. Developers can abandon projects, remove liquidity, or engage in fraudulent activities, resulting in total loss." },
                  { title: "No Guarantees", desc: "There is no guarantee of returns. Past performance does not indicate future results. Many meme coins fail completely." },
                  { title: "Regulatory Uncertainty", desc: "Cryptocurrency regulations are evolving. Changes in regulations could negatively impact meme coin values or trading ability." },
                  { title: "Market Manipulation", desc: "Meme coin markets are susceptible to manipulation, pump-and-dump schemes, and coordinated trading activities." }
                ].map((risk, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <AlertTriangle className="h-4 w-4 text-yellow-500/80 mt-1 flex-shrink-0" />
                    <div className="text-gray-400 group-hover:text-gray-200">
                      <strong className="text-white">{risk.title}:</strong> {risk.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Not Investment Advice */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-sm text-yellow-200/90 leading-relaxed">
                <strong className="text-yellow-500">Not Investment Advice:</strong> This platform provides information and tools
                for trading. We do not provide investment advice, recommendations, or endorsements
                of any cryptocurrency. All trading decisions are your own responsibility.
              </p>
            </div>

            {/* User Responsibility */}
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Your Responsibility:</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-gray-500" /> Only invest what you can afford to lose</li>
                <li className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-gray-500" /> Conduct your own research (DYOR)</li>
                <li className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-gray-500" /> Understand the risks before trading</li>
                <li className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-gray-500" /> Be aware of scams and rug pulls</li>
              </ul>
            </div>

            {/* Acknowledgment Checkbox */}
            <div className="flex items-start gap-4 p-5 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer group" onClick={() => setAcknowledged(!acknowledged)}>
              <Checkbox
                id="risk-acknowledgment"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                className="mt-1 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
              />
              <label
                htmlFor="risk-acknowledgment"
                className="text-sm font-medium text-gray-300 cursor-pointer group-hover:text-white transition-colors leading-relaxed"
              >
                I have read, understood, and acknowledge all the risks associated with trading meme coins.
                I understand that I may lose my entire investment and I am solely responsible for my trading decisions.
              </label>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            {onClose && (
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 h-12 text-gray-400 hover:text-white hover:bg-white/5 border border-white/5"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleAcknowledge}
              disabled={!acknowledged || isSubmitting}
              className={cn(
                "flex-1 h-12 font-bold transition-all duration-300",
                acknowledged
                  ? "bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
              )}
            >
              {isSubmitting ? (
                'Processing...'
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I Understand - Proceed
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
