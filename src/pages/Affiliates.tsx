import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, ChevronUp, DollarSign, Clock, Share2, BarChart2, CheckCircle, Zap } from 'lucide-react';
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

// Component for the expandable FAQ items
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors duration-300 rounded px-4"
      >
        <h3 className="text-lg font-medium text-white">{question}</h3>
        <span>{isOpen ? <ChevronUp className="h-5 w-5 text-purple-400" /> : <ChevronDown className="h-5 w-5 text-purple-400" />}</span>
      </button>
      {isOpen && (
        <div className="pb-5 text-gray-400 animate-fadeIn px-4 leading-relaxed">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
};

export default function Affiliates() {
  const navigate = useNavigate();
  const supabase = createClient();
  const [scrollY, setScrollY] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Add scroll listener for parallax effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // FAQ items
  const faqItems = [
    {
      question: "What is the 0nyx Affiliate Program?",
      answer: "The 0nyx Affiliate Program is a partnership opportunity that allows you to earn commissions by referring customers to our trading journal platform. You'll earn 30% of the cash collected from each referral for 12 months."
    },
    {
      question: "How does the commission structure work?",
      answer: "Affiliates earn 30% of the cash collected from each referral for the first 12 months of the customer's subscription. Payments are calculated monthly and paid out once they meet the minimum threshold."
    },
    {
      question: "When and how will I get paid?",
      answer: "Payments are calculated on a monthly basis and will be paid out when you reach the minimum threshold. You can view your earnings in your affiliate dashboard and payments are typically processed via PayPal or direct bank transfer."
    },
    {
      question: "Is there a minimum payout threshold?",
      answer: "Yes, there is a minimum payout threshold of $50. Once your earnings reach this amount, you'll be eligible for payment in the next payout cycle."
    },
    {
      question: "How do I track my referrals and earnings?",
      answer: "Upon joining the affiliate program, you'll get access to a dashboard where you can track your referrals, conversions, and earnings in real-time."
    },
    {
      question: "What marketing materials are provided?",
      answer: "We provide a variety of marketing materials including banners, email templates, and social media assets to help you promote 0nyx effectively to your audience."
    },
    {
      question: "Are there any restrictions on how I can promote 0nyx?",
      answer: "While we encourage creative promotion, we do have guidelines to ensure our brand is represented properly. These include no spam, no false advertising, and no bidding on our trademark terms in paid search."
    },
    {
      question: "How long is the cookie duration?",
      answer: "We offer a 60-day cookie window, which means you'll earn commission if your referral signs up within 60 days of clicking your affiliate link."
    }
  ];

  return (
    <div className="bg-transparent text-white min-h-screen flex flex-col relative overflow-hidden">
      <Web3GridBackground />

      <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl flex items-center justify-between h-20 px-4 sm:px-6 border-b border-white/5 shadow-2xl">
        {/* Logo */}
        <div className="relative flex items-center h-20 w-64">
          <a
            onClick={() => navigate('/')}
            className="cursor-pointer flex items-center"
          >
            <img src="/images/ot white.svg" alt="0nyxTech Logo" className="h-64 w-auto absolute left-0 top-1/2 -translate-y-1/2" />
          </a>
        </div>

        {/* Center Navigation - Hidden on mobile */}
        <div className="hidden md:flex items-center justify-center flex-1">
          <nav className="flex items-center space-x-12">
            {/* Nav content is empty when on affiliates page as per user request */}
          </nav>
        </div>

        {/* Right side - Sign In/Sign Up */}
        <div className="ml-auto flex items-center gap-4">
          {isAuthenticated ? (
            <UserDropdown />
          ) : (
            <>
              <button
                onClick={() => navigate('/signin')}
                className="text-gray-400 hover:text-white transition-colors duration-300 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-[#e2e2e3] hover:bg-white text-black px-8 py-2.5 rounded-lg transition-all duration-300 font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <main className="pt-20 relative z-10">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 bg-transparent relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <MotionDiv
                initial="hidden"
                animate="visible"
                variants={fadeInUpVariants}
                className="flex flex-col items-center"
              >
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-8 tracking-tight">
                  Join the 0nyx <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Affiliate Program</span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl leading-relaxed">
                  Earn up to <span className="text-white font-bold">30% commissions</span> by simply sharing the web's most powerful trading journal.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => navigate('/affiliate-signup')}
                    className="px-10 py-5 text-xl font-bold bg-[#e2e2e3] text-black rounded-xl hover:bg-white transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                  >
                    Apply Now <ArrowUpRight className="h-6 w-6" />
                  </button>
                  <a
                    href="#learn-more"
                    className="px-10 py-5 text-xl font-bold border border-white/10 text-white rounded-xl hover:bg-white/5 transition-all duration-300"
                  >
                    Learn More
                  </a>
                </div>
              </MotionDiv>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 bg-black/40 border-y border-white/5 backdrop-blur-sm" id="learn-more">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white">How to Get Started</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Step 1 */}
              <MotionDiv
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUpVariants}
                className="bg-white/5 p-10 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 relative group"
              >
                <div className="absolute -top-6 -left-6 h-12 w-12 rounded-xl bg-[#e2e2e3] flex items-center justify-center font-bold text-xl text-black shadow-2xl group-hover:scale-110 transition-transform">
                  1
                </div>
                <h3 className="text-2xl font-bold mb-6 text-white">Apply To Join</h3>
                <p className="text-gray-400 text-lg leading-relaxed">
                  Fill out our quick application form. We'll review your details and get you approved within 3-5 business days.
                </p>
              </MotionDiv>

              {/* Step 2 */}
              <MotionDiv
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ ...fadeInUpVariants, visible: { ...fadeInUpVariants.visible, transition: { ...fadeInUpVariants.visible.transition, delay: 0.2 } } }}
                className="bg-white/5 p-10 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 relative group"
              >
                <div className="absolute -top-6 -left-6 h-12 w-12 rounded-xl bg-[#e2e2e3] flex items-center justify-center font-bold text-xl text-black shadow-2xl group-hover:scale-110 transition-transform">
                  2
                </div>
                <h3 className="text-2xl font-bold mb-6 text-white">Promote 0nyx</h3>
                <p className="text-gray-400 text-lg leading-relaxed">
                  Access your exclusive affiliate dashboard to grab unique referral links and professional marketing assets.
                </p>
              </MotionDiv>

              {/* Step 3 */}
              <MotionDiv
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ ...fadeInUpVariants, visible: { ...fadeInUpVariants.visible, transition: { ...fadeInUpVariants.visible.transition, delay: 0.4 } } }}
                className="bg-white/5 p-10 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 relative group"
              >
                <div className="absolute -top-6 -left-6 h-12 w-12 rounded-xl bg-[#e2e2e3] flex items-center justify-center font-bold text-xl text-black shadow-2xl group-hover:scale-110 transition-transform">
                  3
                </div>
                <h3 className="text-2xl font-bold mb-6 text-white">Get Paid</h3>
                <p className="text-gray-400 text-lg leading-relaxed">
                  Earn generous recursive commissions for every subscriber you bring in. Monthly payouts via bank transfer.
                </p>
              </MotionDiv>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 bg-transparent">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white">Why Become a Partner?</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { icon: DollarSign, title: '30% Recurring Commission', category: 'Earnings', description: 'Receive a massive 30% commission on all your referrals for up to 12 months!' },
                { icon: CheckCircle, title: 'Tiered Payouts', category: 'Growth', description: 'Advance through our partner tiers to unlock higher rates and exclusive rewards.' },
                { icon: Clock, title: '60-Day Cookie Window', category: 'Success', description: 'Benefiting from our extended attribution window ensuring you get the credit.' },
                { icon: Share2, title: 'Partner Support', category: 'Support', description: 'Access standard-setting marketing assets and a dedicated team for your success.' },
                { icon: BarChart2, title: 'Advanced Reports', category: 'Analytics', description: 'Real-time dashboard to track clicks, signups, and commissions with clarity.' },
                { icon: Zap, title: 'Speed & Scale', category: 'Velocity', description: 'Fast approvals and high-converting landing pages built for extreme performance.' }
              ].map((benefit, index) => (
                <MotionDiv
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{ ...fadeInUpVariants, visible: { ...fadeInUpVariants.visible, transition: { ...fadeInUpVariants.visible.transition, delay: index * 0.1 } } }}
                  className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all duration-300 group"
                >
                  <div className="h-14 w-14 bg-white/5 rounded-xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 group-hover:bg-white/10 transition-all">
                    <benefit.icon className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">{benefit.category}</span>
                  <h3 className="text-xl font-bold mb-3 text-white">{benefit.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{benefit.description}</p>
                </MotionDiv>
              ))}
            </div>
          </div>
        </section>

        {/* Commission Structure */}
        <section className="py-24 bg-black/60 border-y border-white/5 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Generous Revenue Share</h2>

              <div className="bg-white/5 p-12 md:p-16 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <DollarSign className="w-64 h-64 text-white" />
                </div>

                <div className="flex flex-col lg:flex-row gap-16 items-center relative z-10">
                  <div className="flex-1">
                    <p className="text-gray-300 text-xl font-medium mb-10 leading-relaxed leading-relaxed">
                      We offer one of the most competitive commission structures in the industry. Earn <span className="text-white font-bold border-b-2 border-white/20">30% revenue share</span> on all collected fees from your referrals for a full year. As you scale, you can unlock lifetime referral commissions.
                    </p>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {[
                        '30% Recurring commission',
                        'Weekly payout cycle',
                        'Low $50 payout threshold',
                        'Lifetime earning potential'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-4 text-white font-bold text-lg">
                          <Check className="h-6 w-6 text-[#e2e2e3] flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="w-full lg:w-[400px]">
                    <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-md">
                      <h3 className="text-lg font-bold mb-6 text-center text-gray-400 uppercase tracking-widest">Growth Potential</h3>
                      <div className="h-48 w-full bg-black/40 rounded-xl overflow-hidden relative border border-white/5">
                        {/* Stylized graph representation */}
                        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-[#e2e2e3]/20 to-transparent clip-path-graph"></div>
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section className="py-24 bg-transparent" id="apply-now">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <MotionDiv
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUpVariants}
                className="bg-white/5 border border-white/10 p-12 md:p-20 rounded-3xl backdrop-blur-md shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white tracking-tight">Become an Official 0nyx Partner</h2>
                <p className="text-xl text-gray-400 mb-12 leading-relaxed max-w-2xl mx-auto">
                  Ready to capitalize on your network? Standard approvals take less than 48 hours. Let's grow together.
                </p>

                <div className="max-w-md mx-auto">
                  <button
                    onClick={() => navigate('/affiliate-signup')}
                    className="w-full py-6 text-2xl font-black bg-[#e2e2e3] text-black rounded-2xl hover:bg-white transition-all duration-300 flex items-center justify-center gap-4 shadow-[0_0_50px_rgba(255,255,255,0.1)] hover:shadow-[0_0_80px_rgba(255,255,255,0.2)] hover:-translate-y-1"
                  >
                    Apply Now <ArrowUpRight className="h-8 w-8" />
                  </button>

                  <p className="mt-8 text-gray-500 font-medium">
                    Already a partner? <a href="#" className="text-white hover:underline transition-colors">Sign in to dashboard</a>
                  </p>
                </div>
              </MotionDiv>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-black/40 border-t border-white/5 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-20 text-white">Questions? We have answers.</h2>

            <div className="max-w-4xl mx-auto bg-white/5 rounded-3xl border border-white/10 p-4 md:p-8 backdrop-blur-md">
              {faqItems.map((item, index) => (
                <FAQItem
                  key={index}
                  question={item.question}
                  answer={item.answer}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-12 bg-black/80 backdrop-blur-md relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center h-10 w-40">
              <img src="/images/ot white.svg" alt="0nyxTech Logo" className="h-40 w-auto" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8">
              <a
                href="https://x.com/0nyxTech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
                aria-label="X (Twitter)"
              >
                <img
                  src="/images/x-logo.png"
                  alt="X (Twitter)"
                  className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity invert"
                />
              </a>
              <a
                href="https://discord.gg/xq5XFHBZ8j"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
                aria-label="Discord"
              >
                <img
                  src="/icons/discord.svg"
                  alt="Discord"
                  className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity invert"
                />
              </a>
              <a
                href="https://www.instagram.com/0nyxtech.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
                aria-label="Instagram"
              >
                <img
                  src="/images/instagram-logo.png"
                  alt="Instagram"
                  className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity invert"
                />
              </a>
              <a href="/affiliates" className="text-gray-400 hover:text-white transition-colors duration-300 text-sm font-medium">Become An Affiliate</a>
              <a href="/terms" className="text-gray-400 hover:text-white transition-colors duration-300 text-sm font-medium">Terms</a>
              <a href="/privacy" className="text-gray-400 hover:text-white transition-colors duration-300 text-sm font-medium">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors duration-300 text-sm font-medium">Contact</a>
            </div>
          </div>
          <div className="text-center mt-12 pt-8 border-t border-white/5">
            <p className="text-gray-500 text-sm">© 2026 0nyxTech. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .clip-path-graph {
          clip-path: polygon(0 100%, 10% 80%, 20% 90%, 30% 70%, 40% 85%, 50% 60%, 60% 40%, 70% 50%, 80% 30%, 90% 10%, 100% 0, 100% 100%);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.7s ease-out forwards;
        }
      `}</style>
    </div>
  );
} 