import React, { useState } from 'react';
import { FileText, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface TradingAgreementModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

export default function TradingAgreementModal({ isOpen, onAgree, onCancel }: TradingAgreementModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const handleAgree = async () => {
    if (!agreed) {
      toast({
        title: 'Agreement Required',
        description: 'Please read and agree to the trading terms before proceeding.',
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

      // Store trading agreement in database
      const { error } = await supabase
        .from('user_risk_acknowledgments')
        .upsert({
          user_id: user.id,
          acknowledgment_type: 'trading_agreement',
          ip_address: ipAddress,
          user_agent: userAgent,
          version: '1.0',
        }, {
          onConflict: 'user_id,acknowledgment_type'
        });

      if (error) {
        throw error;
      }

      onAgree();
      toast({
        title: 'Trading Agreement Accepted',
        description: 'You can now execute trades on the platform.',
      });
    } catch (error: any) {
      console.error('Error saving trading agreement:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save agreement. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-blue-500" />
            Trading Terms and Conditions
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Please read and agree to the following terms before executing trades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Important Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded-lg p-4">
            <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Important Notice
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              By agreeing to these terms, you acknowledge that you understand the risks associated 
              with cryptocurrency trading and agree to be bound by these terms and conditions.
            </p>
          </div>

          {/* Terms Sections */}
          <div className="space-y-4">
            <section>
              <h4 className="font-semibold text-lg mb-2">1. Platform Services</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                This platform provides tools and information for cryptocurrency trading. We act as 
                a technology provider and do not execute trades on your behalf. All trades are 
                executed on decentralized exchanges (DEXs) or through integrated third-party services.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">2. User Responsibilities</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>You are solely responsible for all trading decisions and their consequences</li>
                <li>You must ensure you have sufficient funds and understand the transaction fees</li>
                <li>You are responsible for maintaining the security of your wallet and private keys</li>
                <li>You must comply with all applicable laws and regulations in your jurisdiction</li>
                <li>You must not use the platform for illegal activities or money laundering</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">3. Risk Acknowledgment</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                You acknowledge and agree that:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>Cryptocurrency trading involves substantial risk of loss</li>
                <li>Prices can be extremely volatile and may result in total loss</li>
                <li>Past performance does not guarantee future results</li>
                <li>You may lose your entire investment</li>
                <li>You should only trade with funds you can afford to lose</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">4. No Investment Advice</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                This platform does not provide investment, financial, or trading advice. All 
                information, tools, and features are provided for informational purposes only. 
                You should conduct your own research (DYOR) and consult with qualified financial 
                advisors before making trading decisions.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">5. Platform Limitations</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>We do not guarantee the accuracy, completeness, or timeliness of data</li>
                <li>Platform may experience downtime, delays, or technical issues</li>
                <li>We are not responsible for losses due to technical failures or errors</li>
                <li>Third-party services (DEXs, wallets) operate independently</li>
                <li>We are not liable for actions of third-party services</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">6. Prohibited Activities</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                You agree not to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>Use the platform for illegal purposes</li>
                <li>Manipulate prices or engage in market manipulation</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Interfere with platform operations or security</li>
                <li>Attempt to gain unauthorized access to the platform</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">7. Limitation of Liability</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                To the maximum extent permitted by law, we shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, or any loss of profits, 
                revenue, data, or use, incurred by you or any third party, whether in an action 
                in contract or tort, arising from your use of the platform.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">8. Indemnification</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You agree to indemnify, defend, and hold harmless the platform and its operators 
                from any claims, damages, losses, liabilities, and expenses (including legal fees) 
                arising from your use of the platform or violation of these terms.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">9. Modifications to Terms</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                We reserve the right to modify these terms at any time. Continued use of the 
                platform after modifications constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-lg mb-2">10. Governing Law</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                These terms shall be governed by and construed in accordance with applicable laws. 
                Any disputes shall be resolved through appropriate legal channels.
              </p>
            </section>
          </div>

          {/* Acknowledgment Checkbox */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600">
            <Checkbox
              id="trading-agreement"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-1"
            />
            <label
              htmlFor="trading-agreement"
              className="text-sm font-medium cursor-pointer flex-1"
            >
              I have read, understood, and agree to be bound by these Trading Terms and Conditions. 
              I acknowledge that I am solely responsible for my trading decisions and understand 
              the risks involved. I confirm that I am of legal age and have the legal capacity to 
              enter into this agreement.
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAgree}
            disabled={!agreed || isSubmitting}
            className={cn(
              "flex-1",
              agreed 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-gray-400 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              'Processing...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                I Agree - Proceed to Trading
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
