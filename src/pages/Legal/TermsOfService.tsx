import React from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

export default function TermsOfService() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={cn(
      "min-h-screen p-6 md:p-12",
      isDark ? "bg-[#0a0e17] text-gray-100" : "bg-white text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-blue-500" />
          <h1 className="text-4xl font-bold">Terms of Service</h1>
        </div>

        <div className={cn(
          "p-6 rounded-lg mb-6",
          isDark ? "bg-[#1a1f2e] border border-[#374151]" : "bg-gray-50 border border-gray-200"
        )}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm">
            Please read these Terms of Service carefully before using our platform. By accessing or using 
            our services, you agree to be bound by these terms.
          </p>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              By accessing and using this platform, you accept and agree to be bound by the terms and 
              provision of this agreement. If you do not agree to abide by the above, please do not use 
              this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our platform provides tools and information for cryptocurrency trading, including but not 
              limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Real-time cryptocurrency price data and charts</li>
              <li>Trading tools and interfaces</li>
              <li>Market analysis and information</li>
              <li>Portfolio tracking features</li>
              <li>Integration with decentralized exchanges (DEXs)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Maintaining the security of your account and wallet credentials</li>
              <li>All activities that occur under your account</li>
              <li>Ensuring compliance with all applicable laws and regulations</li>
              <li>Conducting your own research before making trading decisions</li>
              <li>Understanding the risks associated with cryptocurrency trading</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Risk Acknowledgment</h2>
            <div className={cn(
              "p-4 rounded-lg mb-4",
              isDark ? "bg-red-900/20 border border-red-600" : "bg-red-50 border border-red-200"
            )}>
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <h3 className="font-semibold text-red-800 dark:text-red-200">Critical Risk Warning</h3>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">
                Cryptocurrency trading involves substantial risk of loss. Prices are highly volatile and 
                can result in total loss of investment. You should only trade with funds you can afford 
                to lose completely.
              </p>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              By using this platform, you acknowledge that you understand and accept these risks.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. No Investment Advice</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              This platform does not provide investment, financial, or trading advice. All information, 
              tools, and features are provided for informational purposes only. You should:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Conduct your own research (DYOR - Do Your Own Research)</li>
              <li>Consult with qualified financial advisors</li>
              <li>Not rely solely on information provided by this platform</li>
              <li>Make independent trading decisions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Platform Limitations</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We do not guarantee:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>The accuracy, completeness, or timeliness of data</li>
              <li>Uninterrupted or error-free service</li>
              <li>That the platform will meet your requirements</li>
              <li>Results from using the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Prohibited Activities</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Use the platform for illegal purposes</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Interfere with platform operations or security</li>
              <li>Attempt to gain unauthorized access</li>
              <li>Engage in market manipulation</li>
              <li>Transmit viruses or malicious code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, 
              special, consequential, or punitive damages, or any loss of profits, revenue, data, or use, 
              incurred by you or any third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You agree to indemnify, defend, and hold harmless the platform and its operators from any 
              claims, damages, losses, liabilities, and expenses (including legal fees) arising from your 
              use of the platform or violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Modifications to Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We reserve the right to modify these terms at any time. Continued use of the platform after 
              modifications constitutes acceptance of the updated terms. We will notify users of significant 
              changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We reserve the right to terminate or suspend your access to the platform at any time, without 
              prior notice, for any reason, including violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              These terms shall be governed by and construed in accordance with applicable laws. Any 
              disputes shall be resolved through appropriate legal channels.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have any questions about these Terms of Service, please contact us through the 
              platform's support channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
