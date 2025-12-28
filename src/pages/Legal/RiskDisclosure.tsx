import React from 'react';
import { AlertTriangle, TrendingDown, Shield } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

export default function RiskDisclosure() {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={cn(
      "min-h-screen p-6 md:p-12",
      isDark ? "bg-[#0a0e17] text-gray-100" : "bg-white text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <h1 className="text-4xl font-bold">Risk Disclosure Statement</h1>
        </div>

        <div className={cn(
          "p-6 rounded-lg mb-6 border-2",
          isDark ? "bg-red-900/20 border-red-600" : "bg-red-50 border-red-400"
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                CRITICAL RISK WARNING
              </h2>
              <p className="text-red-700 dark:text-red-300">
                Trading cryptocurrencies, especially meme coins, involves EXTREMELY HIGH RISK. 
                You may lose your entire investment. This document outlines the significant risks 
                you should understand before trading.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-red-500" />
              1. Market Volatility Risk
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Cryptocurrency markets are highly volatile. Prices can fluctuate dramatically within 
              minutes, hours, or days. Factors contributing to volatility include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Market sentiment and news events</li>
              <li>Regulatory announcements</li>
              <li>Technological developments</li>
              <li>Market manipulation and coordinated trading</li>
              <li>Low liquidity in many markets</li>
              <li>Social media influence and hype</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              <strong>Impact:</strong> You may experience significant losses, including total loss 
              of your investment, in a very short period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Liquidity Risk</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Many cryptocurrencies, especially meme coins, have limited liquidity. This means:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>You may not be able to buy or sell at desired prices</li>
              <li>Large orders can significantly impact prices (slippage)</li>
              <li>You may be unable to exit positions during market stress</li>
              <li>Bid-ask spreads can be very wide</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              <strong>Impact:</strong> You may be unable to execute trades or may receive prices 
              significantly different from market quotes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Total Loss Risk</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Unlike traditional investments, cryptocurrencies can become completely worthless. 
              This can occur due to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Project abandonment by developers</li>
              <li>Rug pulls and exit scams</li>
              <li>Technical failures or vulnerabilities</li>
              <li>Regulatory bans or restrictions</li>
              <li>Loss of market confidence</li>
              <li>Competition from other projects</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              <strong>Impact:</strong> You may lose 100% of your investment with no possibility 
              of recovery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Meme Coin Specific Risks</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Meme coins carry additional risks beyond general cryptocurrency risks:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>No Intrinsic Value:</strong> Many meme coins lack utility or real-world applications</li>
              <li><strong>Hype-Driven:</strong> Prices often driven by social media trends rather than fundamentals</li>
              <li><strong>High Failure Rate:</strong> Most meme coins fail within weeks or months</li>
              <li><strong>Pump and Dump Schemes:</strong> Coordinated manipulation to inflate prices before dumping</li>
              <li><strong>Low Development Activity:</strong> Many projects have minimal or no development</li>
              <li><strong>Concentration Risk:</strong> Large holders can manipulate prices</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Regulatory Risk</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Cryptocurrency regulations are evolving and vary by jurisdiction. Risks include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Sudden regulatory changes or bans</li>
              <li>Tax implications and reporting requirements</li>
              <li>Restrictions on trading or holding</li>
              <li>Classification as securities subject to strict regulations</li>
              <li>Potential for retroactive regulation</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              <strong>Impact:</strong> Regulations could make trading illegal, subject you to taxes, 
              or require costly compliance measures.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Technical Risk</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Technical risks include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Smart contract vulnerabilities and exploits</li>
              <li>Network congestion and high transaction fees</li>
              <li>Platform downtime or technical failures</li>
              <li>Loss of private keys or wallet access</li>
              <li>Hacking and security breaches</li>
              <li>Software bugs and errors</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Operational Risk</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Risks related to platform operations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Service interruptions or downtime</li>
              <li>Data inaccuracies or delays</li>
              <li>Third-party service failures</li>
              <li>Integration issues with DEXs or wallets</li>
              <li>Errors in order execution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Counterparty Risk</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              When trading on decentralized exchanges or using third-party services, you face:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>No central authority to resolve disputes</li>
              <li>Irreversible transactions</li>
              <li>No insurance or protection funds</li>
              <li>Dependence on smart contract functionality</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6 text-yellow-500" />
              9. Important Considerations
            </h2>
            <div className={cn(
              "p-4 rounded-lg",
              isDark ? "bg-yellow-900/20 border border-yellow-600" : "bg-yellow-50 border border-yellow-200"
            )}>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                <strong>Before trading, you should:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300 ml-4">
                <li>Only invest what you can afford to lose completely</li>
                <li>Understand that you may lose your entire investment</li>
                <li>Conduct thorough research (DYOR - Do Your Own Research)</li>
                <li>Understand the technology and risks</li>
                <li>Be aware of scams and fraudulent projects</li>
                <li>Consider consulting with a financial advisor</li>
                <li>Never invest based solely on social media recommendations</li>
                <li>Be prepared for extreme price volatility</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. No Guarantees</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              There are no guarantees when trading cryptocurrencies:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>No guarantee of returns or profits</li>
              <li>No guarantee of liquidity</li>
              <li>No guarantee of price stability</li>
              <li>No guarantee that you can exit positions</li>
              <li>Past performance does not guarantee future results</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Acknowledgment</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              By using this platform, you acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>You have read and understood this Risk Disclosure Statement</li>
              <li>You understand the risks involved in cryptocurrency trading</li>
              <li>You are solely responsible for your trading decisions</li>
              <li>You accept the possibility of total loss</li>
              <li>You have the financial capacity to bear these risks</li>
              <li>You are not relying on any guarantees or promises of returns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have questions about these risks, please contact us through the platform's 
              support channels before trading.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
