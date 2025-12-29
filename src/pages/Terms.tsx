import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { UserDropdown } from '@/components/ui/user-dropdown';
import Web3GridBackground from '@/components/ui/Web3GridBackground';
import * as framerMotion from 'framer-motion';

// Create type-safe components
type MotionProps = {
  children?: React.ReactNode;
  className?: string;
  initial?: any;
  whileInView?: any;
  viewport?: any;
  variants?: any;
  [key: string]: any;
};

const FallbackMotionDiv = ({ children, ...props }: MotionProps) => <div {...props}>{children}</div>;
const MotionDiv = (framerMotion?.motion?.div ?? FallbackMotionDiv) as React.ComponentType<MotionProps>;

const fadeInUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function Terms() {
  const navigate = useNavigate();
  const supabase = createClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  return (
    <div className="bg-transparent text-white min-h-screen flex flex-col relative overflow-hidden">
      <Web3GridBackground />

      <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl flex items-center justify-between h-20 px-4 sm:px-6 border-b border-white/5 shadow-2xl">
        <div className="relative flex items-center h-20 w-64">
          <a
            onClick={() => navigate('/')}
            className="cursor-pointer flex items-center"
          >
            <img src="/images/ot white.svg" alt="0nyxTech Logo" className="h-64 w-auto absolute left-0 top-1/2 -translate-y-1/2" />
          </a>
        </div>

        <nav className="hidden md:flex items-center space-x-8">
          <button
            onClick={() => navigate('/affiliates')}
            className="text-gray-300 hover:text-white transition-colors duration-300 font-medium"
          >
            Affiliates
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <UserDropdown />
          ) : (
            <>
              <button
                onClick={() => navigate('/signin')}
                className="text-gray-300 hover:text-white transition-colors px-4 py-2 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-[#e2e2e3] hover:bg-white text-black px-6 py-2 rounded-lg transition-all duration-300 font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Sign Up Free
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 pt-32 pb-16 max-w-4xl relative z-10">
        <MotionDiv
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUpVariants}
          className="bg-[#030303]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 md:p-12 shadow-2xl"
        >
          <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">Terms of Service</h1>

          <div className="prose prose-invert max-w-none">
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">1</span>
                Introduction
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Welcome to 0nyx Trading ("we," "our," or "us"). By accessing or using our website, mobile application, and services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms").
              </p>
              <p className="text-gray-400 leading-relaxed">
                Please read these Terms carefully. If you do not agree with these Terms, you may not access or use our Services.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">2</span>
                Account Registration
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                To use certain features of our Services, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
              </p>
              <p className="text-gray-400 leading-relaxed">
                You are responsible for safeguarding your password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">3</span>
                Subscription and Payments
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Some of our Services require payment of fees. All fees are stated in US dollars unless otherwise specified.
              </p>
              <p className="text-gray-400 leading-relaxed mb-4">
                You agree to pay all fees in accordance with the billing terms in effect at the time a fee is due and payable. If you dispute any charges, you must notify us within 30 days after the date that we invoice you.
              </p>
              <p className="text-gray-400 leading-relaxed">
                We reserve the right to change our prices at any time. If we change our prices, we will provide notice of the change on the website or by email, at our option.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">4</span>
                User Content
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Our Services allow you to store, share, and otherwise make available certain information, text, graphics, or other material ("User Content"). You retain all rights in, and are solely responsible for, the User Content you post to our Services.
              </p>
              <p className="text-gray-400 leading-relaxed">
                By making any User Content available through our Services, you grant us a non-exclusive, transferable, sublicensable, worldwide, royalty-free license to use, copy, modify, create derivative works based upon, distribute, publicly display, and publicly perform your User Content in connection with operating and providing our Services.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">5</span>
                Prohibited Conduct
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">You agree not to:</p>
              <ul className="space-y-3 text-gray-400 mb-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Use our Services for any illegal purpose or in violation of any laws or regulations</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Violate or infringe other people's intellectual property, privacy, or other rights</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Interfere with or disrupt our Services or servers or networks connected to our Services</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Attempt to gain unauthorized access to our Services or user accounts</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">6</span>
                Termination
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                We may terminate or suspend your account and access to our Services immediately, without prior notice or liability, for any reason, including if you breach these Terms.
              </p>
              <p className="text-gray-400 leading-relaxed">
                Upon termination, your right to use our Services will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">7</span>
                Disclaimer of Warranties
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4 italic">
                OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
              <p className="text-gray-400 leading-relaxed">
                WE DO NOT WARRANT THAT THE SERVICES ARE ERROR FREE OR THAT ACCESS THERETO WILL BE UNINTERRUPTED OR ERROR FREE.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">8</span>
                Limitation of Liability
              </h2>
              <p className="text-gray-400 leading-relaxed italic">
                IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICES.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">9</span>
                Changes to Terms
              </h2>
              <p className="text-gray-400 leading-relaxed">
                We reserve the right to modify these Terms at any time. If we make changes to these Terms, we will provide notice of such changes by updating the date at the top of these Terms and by maintaining a current version of the Terms at our website. Your continued use of our Services following the posting of revised Terms means that you accept and agree to the changes.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">10</span>
                Contact Information
              </h2>
              <p className="text-gray-400 leading-relaxed">
                If you have any questions about these Terms, please contact us at <span className="text-white">support@0nyxtech.xyz</span>.
              </p>
            </section>
          </div>
        </MotionDiv>
      </main>

      <footer className="w-full border-t border-white/5 py-12 bg-black/40 backdrop-blur-xl relative z-10">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-8">
              <a href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Terms</a>
              <a href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">© 2026 0nyxTech. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 