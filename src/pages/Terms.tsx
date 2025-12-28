import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Terms() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        
        <div className="prose max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Welcome to 0nyx Trading ("we," "our," or "us"). By accessing or using our website, mobile application, and services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms").
            </p>
            <p className="text-gray-700 mb-4">
              Please read these Terms carefully. If you do not agree with these Terms, you may not access or use our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">2. Account Registration</h2>
            <p className="text-gray-700 mb-4">
              To use certain features of our Services, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
            </p>
            <p className="text-gray-700 mb-4">
              You are responsible for safeguarding your password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">3. Subscription and Payments</h2>
            <p className="text-gray-700 mb-4">
              Some of our Services require payment of fees. All fees are stated in US dollars unless otherwise specified.
            </p>
            <p className="text-gray-700 mb-4">
              You agree to pay all fees in accordance with the billing terms in effect at the time a fee is due and payable. If you dispute any charges, you must notify us within 30 days after the date that we invoice you.
            </p>
            <p className="text-gray-700 mb-4">
              We reserve the right to change our prices at any time. If we change our prices, we will provide notice of the change on the website or by email, at our option.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">4. User Content</h2>
            <p className="text-gray-700 mb-4">
              Our Services allow you to store, share, and otherwise make available certain information, text, graphics, or other material ("User Content"). You retain all rights in, and are solely responsible for, the User Content you post to our Services.
            </p>
            <p className="text-gray-700 mb-4">
              By making any User Content available through our Services, you grant us a non-exclusive, transferable, sublicensable, worldwide, royalty-free license to use, copy, modify, create derivative works based upon, distribute, publicly display, and publicly perform your User Content in connection with operating and providing our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">5. Prohibited Conduct</h2>
            <p className="text-gray-700 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Use our Services for any illegal purpose or in violation of any laws or regulations</li>
              <li>Violate or infringe other people's intellectual property, privacy, or other rights</li>
              <li>Interfere with or disrupt our Services or servers or networks connected to our Services</li>
              <li>Attempt to gain unauthorized access to our Services or user accounts</li>
              <li>Use any data mining, robots, or similar data gathering or extraction methods</li>
              <li>Impersonate any person or entity or falsely state or otherwise misrepresent your affiliation with a person or entity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">6. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your account and access to our Services immediately, without prior notice or liability, for any reason, including if you breach these Terms.
            </p>
            <p className="text-gray-700 mb-4">
              Upon termination, your right to use our Services will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">7. Disclaimer of Warranties</h2>
            <p className="text-gray-700 mb-4">
              OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-gray-700 mb-4">
              WE DO NOT WARRANT THAT THE SERVICES ARE ERROR FREE OR THAT ACCESS THERETO WILL BE UNINTERRUPTED OR ERROR FREE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICES.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">9. Changes to Terms</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify these Terms at any time. If we make changes to these Terms, we will provide notice of such changes by updating the date at the top of these Terms and by maintaining a current version of the Terms at our website. Your continued use of our Services following the posting of revised Terms means that you accept and agree to the changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-magenta-500 mb-4">10. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about these Terms, please contact us at support@wagyutrading.com.
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