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

export default function Privacy() {
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
          <h1 className="text-4xl font-bold text-white mb-8 tracking-tight">Privacy Policy</h1>

          <div className="prose prose-invert max-w-none">
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">1</span>
                Introduction
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                At 0nyx Trading ("we," "our," or "us"), we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and services (collectively, the "Services").
              </p>
              <p className="text-gray-400 leading-relaxed">
                Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access or use our Services.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">2</span>
                Information We Collect
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                We collect several types of information from and about users of our Services, including:
              </p>
              <ul className="space-y-3 text-gray-400 mb-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span><strong>Personal Data:</strong> Personal identifiers such as name, email address, and payment information.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span><strong>Usage Data:</strong> Information about how you use our Services, including your trading data, preferences, and activity logs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span><strong>Device Data:</strong> Information about your device, browser, IP address, and operating system.</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">3</span>
                How We Use Your Information
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">We use the information we collect for various purposes, including to:</p>
              <ul className="space-y-3 text-gray-400 mb-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Provide, maintain, and improve our Services</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Process transactions and send related information</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span>Respond to your comments, questions, and requests</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">4</span>
                How We Share Your Information
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                We may share your information in the following situations:
              </p>
              <ul className="space-y-3 text-gray-400 mb-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span><strong>With Service Providers:</strong> Third-party vendors who perform services for us.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <span><strong>Legal Requirements:</strong> Where required to do so by law or in response to valid requests.</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">5</span>
                Data Security
              </h2>
              <p className="text-gray-400 leading-relaxed">
                We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">6</span>
                Data Retention
              </h2>
              <p className="text-gray-400 leading-relaxed">
                We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Policy, unless a longer retention period is required or permitted by law.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">7</span>
                Your Privacy Rights
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data.
              </p>
              <p className="text-gray-400 leading-relaxed">
                To exercise these rights, please contact us using the contact information provided below.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm border border-white/10">8</span>
                Contact Us
              </h2>
              <p className="text-gray-400 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at: <span className="text-white">privacy@0nyxtech.xyz</span>
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