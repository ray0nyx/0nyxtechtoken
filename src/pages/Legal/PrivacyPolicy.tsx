import React from 'react';
import { Shield, Lock } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

export default function PrivacyPolicy() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={cn(
      "min-h-screen p-6 md:p-12",
      isDark ? "bg-[#0a0e17] text-gray-100" : "bg-white text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-blue-500" />
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
        </div>

        <div className={cn(
          "p-6 rounded-lg mb-6",
          isDark ? "bg-[#1a1f2e] border border-[#374151]" : "bg-gray-50 border border-gray-200"
        )}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm">
            We are committed to protecting your privacy. This Privacy Policy explains how we collect, 
            use, and safeguard your information when you use our platform.
          </p>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <h3 className="text-xl font-medium mb-2 mt-4">1.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Account information (email, username)</li>
              <li>Wallet addresses (when connected)</li>
              <li>Trading preferences and settings</li>
              <li>Risk acknowledgments and agreements</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-4">1.2 Automatically Collected Information</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>IP address and location data</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Provide and improve our services</li>
              <li>Process transactions and orders</li>
              <li>Send notifications and alerts</li>
              <li>Ensure platform security and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Analyze usage patterns to improve user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We do not sell your personal information. We may share information only in the following 
              circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations or court orders</li>
              <li>To protect our rights and prevent fraud</li>
              <li>With service providers who assist in platform operations (under strict confidentiality)</li>
              <li>In connection with a business transfer or merger</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <div className={cn(
              "p-4 rounded-lg mb-4 flex items-start gap-2",
              isDark ? "bg-blue-900/20 border border-blue-600" : "bg-blue-50 border border-blue-200"
            )}>
              <Lock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Security Measures</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  We implement industry-standard security measures including encryption, secure connections, 
                  and access controls to protect your information. However, no method of transmission over 
                  the internet is 100% secure.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt-out of certain data collection</li>
              <li>Export your data</li>
              <li>Withdraw consent where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Remember your preferences</li>
              <li>Analyze platform usage</li>
              <li>Improve security</li>
              <li>Provide personalized experiences</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              You can control cookies through your browser settings, though this may affect platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our platform integrates with third-party services including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Decentralized exchanges (DEXs)</li>
              <li>Blockchain networks</li>
              <li>Analytics services</li>
              <li>Payment processors</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              These services have their own privacy policies. We are not responsible for their practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We retain your information for as long as necessary to provide services, comply with legal 
              obligations, resolve disputes, and enforce our agreements. When you delete your account, 
              we will delete or anonymize your personal information, subject to legal retention requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our platform is not intended for users under the age of 18. We do not knowingly collect 
              information from children. If you believe we have collected information from a child, please 
              contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. International Users</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you are using our platform from outside the United States, please note that your information 
              may be transferred to, stored, and processed in the United States. By using our platform, 
              you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Privacy Policy</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of significant 
              changes by posting the new policy on this page and updating the "Last Updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have questions about this Privacy Policy or wish to exercise your rights, please 
              contact us through the platform's support channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
