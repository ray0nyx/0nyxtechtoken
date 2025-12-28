import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 items-center px-4 border-b border-gray-200">
        <div 
          className="font-extrabold text-xl text-magenta-500 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <span className="text-purple-500">0nyx</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/pricing')} className="text-gray-700 hover:text-magenta-500">
            Pricing
          </Button>
          <Button variant="ghost" onClick={() => navigate('/signin')} className="text-gray-700 hover:text-magenta-500">
            Sign In
          </Button>
          <Button onClick={() => navigate('/signup')} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20">
            Sign Up
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="prose max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              At 0nyx Trading ("we," "our," or "us"), we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and services (collectively, the "Services").
            </p>
            <p className="text-gray-700 mb-4">
              Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access or use our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">2. Information We Collect</h2>
            <p className="text-gray-700 mb-4">
              We collect several types of information from and about users of our Services, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Personal Data:</strong> Personal identifiers such as name, email address, and payment information.</li>
              <li><strong>Usage Data:</strong> Information about how you use our Services, including your trading data, preferences, and activity logs.</li>
              <li><strong>Device Data:</strong> Information about your device, browser, IP address, and operating system.</li>
              <li><strong>Cookies and Similar Technologies:</strong> We use cookies and similar tracking technologies to track activity on our Services and hold certain information.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">
              We use the information we collect for various purposes, including to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Provide, maintain, and improve our Services</li>
              <li>Process transactions and send related information</li>
              <li>Send administrative information, such as updates, security alerts, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Personalize your experience and deliver content relevant to your interests</li>
              <li>Monitor and analyze trends, usage, and activities in connection with our Services</li>
              <li>Detect, prevent, and address technical issues, fraud, and other illegal activities</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">4. How We Share Your Information</h2>
            <p className="text-gray-700 mb-4">
              We may share your information in the following situations:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>With Service Providers:</strong> We may share your information with third-party vendors, service providers, contractors, or agents who perform services for us.</li>
              <li><strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
              <li><strong>With Your Consent:</strong> We may disclose your information for any other purpose with your consent.</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information where required to do so by law or in response to valid requests by public authorities.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">5. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">6. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Policy, unless a longer retention period is required or permitted by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">7. Your Privacy Rights</h2>
            <p className="text-gray-700 mb-4">
              Depending on your location, you may have certain rights regarding your personal information, such as:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>The right to access the personal information we have about you</li>
              <li>The right to request that we correct or update any personal information we have about you</li>
              <li>The right to request that we delete any personal information we have about you</li>
              <li>The right to object to the processing of your personal information</li>
              <li>The right to request portability of your personal information</li>
              <li>The right to withdraw consent at any time where we relied on your consent to process your personal information</li>
            </ul>
            <p className="text-gray-700 mb-4">
              To exercise these rights, please contact us using the contact information provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">8. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Our Services are not intended for children under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">9. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top of this Privacy Policy.
            </p>
            <p className="text-gray-700 mb-4">
              You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">10. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-gray-700 mb-4">
              Email: privacy@wagyutrading.com
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 py-6 bg-gray-50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center gap-4 text-center text-sm">
            <div className="flex items-center gap-4">
              <a href="/terms" className="text-gray-500 hover:text-magenta-500">Terms</a>
              <a href="/privacy" className="text-gray-500 hover:text-magenta-500">Privacy</a>
              <a href="#" className="text-gray-500 hover:text-magenta-500">Contact</a>
            </div>
            <p className="text-gray-500">© 2024 0nyx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 