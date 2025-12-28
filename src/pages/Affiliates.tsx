import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, ChevronUp, DollarSign, Clock, Share2, BarChart2, CheckCircle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { UserDropdown } from '@/components/ui/user-dropdown';

// Component for the expandable FAQ items
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-gray-200">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors duration-300 rounded px-2"
      >
        <h3 className="text-lg font-medium text-gray-900">{question}</h3>
        <span>{isOpen ? <ChevronUp className="h-5 w-5 text-purple-500" /> : <ChevronDown className="h-5 w-5 text-purple-500" />}</span>
      </button>
      {isOpen && (
        <div className="pb-5 text-gray-700 animate-fadeIn px-2">
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
    <div className="bg-white text-gray-900 min-h-screen flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-white flex items-center justify-between h-16 px-4 sm:px-6 border-b border-gray-200">
        {/* Logo */}
        <div className="font-extrabold text-xl relative flex items-center" itemScope itemType="https://schema.org/Organization">
          <a 
            onClick={() => navigate('/')}
            className="cursor-pointer flex items-center"
          >
            <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
            <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
          </a>
        </div>

        {/* Center Navigation - Hidden on mobile */}
        <div className="hidden md:flex items-center justify-center flex-1">
          <nav className="flex items-center space-x-8">
            <button 
              onClick={() => navigate('/pricing')} 
              className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium"
            >
              Pricing
            </button>
            <button 
              onClick={() => navigate('/affiliates')} 
              className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium"
            >
              Become An Affiliate
            </button>
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
                className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium"
              >
                Sign In
              </button>
              <button 
                onClick={() => navigate('/signup')} 
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg transition-all duration-300 font-medium"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section with parallax effect */}
        <section className="w-full py-20 bg-white relative overflow-hidden">
          {/* Background elements with parallax */}
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" 
              style={{ transform: `translateY(${scrollY * 0.1}px)` }}
            ></div>
            <div 
              className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
              style={{ transform: `translateY(${scrollY * -0.05}px)` }}
            ></div>
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-fadeInUp"
                style={{ animationDelay: '0.1s' }}
              >
                Join the 0nyx <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-purple-600">Affiliate Program</span>
              </h1>
              <p 
                className="text-xl md:text-2xl text-gray-700 mb-8 animate-fadeInUp"
                style={{ animationDelay: '0.3s' }}
              >
                Earn up to 30% commissions by simply sharing 0nyx
              </p>
              <div 
                className="flex flex-col sm:flex-row gap-4 justify-center animate-fadeInUp"
                style={{ animationDelay: '0.5s' }}
              >
                <a 
                  onClick={() => navigate('/affiliate-signup')}
                  className="px-8 py-5 text-xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
                >
                  Apply Now <ArrowUpRight className="h-5 w-5" />
                </a>
                <a 
                  href="#learn-more" 
                  className="px-8 py-5 text-xl font-bold border border-purple-500 text-purple-500 rounded-lg hover:bg-purple-500/10 transition-all duration-300 flex items-center justify-center"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gray-50" id="learn-more">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-purple-600">How to Get Started</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-white p-8 rounded-lg border border-gray-200 hover:border-purple-500/50 transition-all duration-300 relative hover:translate-y-[-5px] hover:shadow-lg hover:shadow-purple-500/10">
                <div className="absolute -top-5 -left-5 h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/20 text-white">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-4 text-purple-500">Apply To Join</h3>
                <p className="text-gray-700 text-lg font-bold">
                  Fill out our application form. We'll review your details and get back to you within 3-5 business days.
                </p>
              </div>
              
              {/* Step 2 */}
              <div className="bg-white p-8 rounded-lg border border-gray-200 hover:border-purple-500/50 transition-all duration-300 relative hover:translate-y-[-5px] hover:shadow-lg hover:shadow-purple-500/10">
                <div className="absolute -top-5 -left-5 h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/20 text-white">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-4 text-purple-500">Promote 0nyx</h3>
                <p className="text-gray-700 text-lg font-bold">
                  Access your affiliate dashboard, get your unique referral links, and start promoting 0nyx to your audience.
                </p>
              </div>
              
              {/* Step 3 */}
              <div className="bg-white p-8 rounded-lg border border-gray-200 hover:border-purple-500/50 transition-all duration-300 relative hover:translate-y-[-5px] hover:shadow-lg hover:shadow-purple-500/10">
                <div className="absolute -top-5 -left-5 h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/20 text-white">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-4 text-purple-500">Get Paid and Grow</h3>
                <p className="text-gray-700 text-lg font-bold">
                  Earn generous commissions for every referral that subscribes to 0nyx. Get paid monthly via PayPal or bank transfer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Why Become a 0nyx Affiliate?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Benefit 1 */}
              <div className="bg-gray-50 p-8 rounded-lg text-center hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-16 w-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">30% Recurring Commission</h3>
                <p className="text-gray-700 text-lg font-bold">
                  Receive a massive 30% commission on all your referrals for up to 12 months!
                </p>
              </div>
              
              {/* Benefit 2 */}
              <div className="bg-gray-50 p-8 rounded-lg text-center hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-16 w-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Tiered Payouts</h3>
                <p className="text-gray-700 text-lg font-bold">
                  Advance through our affiliate tiers based on performance to unlock higher commission rates and exclusive rewards.
                </p>
              </div>
              
              {/* Benefit 3 */}
              <div className="bg-gray-50 p-8 rounded-lg text-center hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-16 w-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">60-Day Cookie Window</h3>
                <p className="text-gray-700 text-lg font-bold">
                  Benefit from our extended 60-day attribution period, ensuring you get credited for conversions long after the initial click.
                </p>
              </div>
              
              {/* Benefit 4 */}
              <div className="bg-gray-50 p-8 rounded-lg text-center hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-16 w-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Share2 className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Partner Support</h3>
                <p className="text-gray-700 text-lg font-bold">
                  We're with you every step of the way with our growing collection of marketing assets, dedicated support team to help you succeed.
                </p>
              </div>
              
              {/* Benefit 5 */}
              <div className="bg-gray-50 p-8 rounded-lg text-center hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-16 w-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BarChart2 className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Coaching & Reports</h3>
                <p className="text-gray-700 text-lg font-bold">
                  As we implement our copy trading and coaching service you will get see the power our wagyutech.
                </p>
              </div>
              
              {/* Benefit 6 */}
              <div className="bg-gray-50 p-8 rounded-lg text-center hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105">
                <div className="h-16 w-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Lifetime Commission Potential</h3>
                <p className="text-gray-700 text-lg font-bold">
                  As you tier up and grow with us, you'll have the opportunity to earn lifetime commissions on your referrals.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Commission Structure */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Earn up to 30% Commissions!</h2>
              
              <div className="bg-white p-8 rounded-lg border border-gray-200">
                <p className="text-gray-700 text-lg font-bold mb-6">
                  We have one of the best commission structures in the space and want you to succeed with us! Earn 30% on all cash collected from all your referrals for a period of 12 months. As you tier up and grow with us you will also have the opportunity to earn a lifetime commission!
                </p>
                
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1">
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <Check className="h-6 w-6 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span className="text-lg font-bold">30% commission on all referrals for 12 months</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="h-6 w-6 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span className="text-lg font-bold">Monthly payment schedule</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="h-6 w-6 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span className="text-lg font-bold">Minimum $50 payout threshold</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="h-6 w-6 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span className="text-lg font-bold">Opportunity for lifetime commissions as you tier up</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="flex-1">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold mb-4 text-center">Your Affiliate Income</h3>
                      <div className="h-40 w-full bg-gray-200 rounded-lg overflow-hidden relative">
                        {/* Stylized graph representation */}
                        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-purple-500/80 to-blue-500/50 clip-path-graph"></div>
                        
                        {/* Axes labels */}
                        <div className="absolute top-2 right-2 text-xs text-gray-400">Income</div>
                        <div className="absolute bottom-2 left-2 text-xs text-gray-400">Time</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section className="py-20 bg-white" id="apply-now">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Apply to the 0nyx Affiliate Program</h2>
              <p className="text-gray-700 text-lg font-bold">Fill out the form below to join our affiliate program. We'll review your application and get back to you within 3-5 business days.</p>
            </div>
            
            <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg border border-gray-200">
              <button 
                onClick={() => navigate('/affiliate-signup')}
                className="w-full py-5 text-xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
              >
                Apply Now <ArrowUpRight className="h-5 w-5" />
              </button>
              
              <div className="mt-6 text-center text-gray-400 text-base font-bold">
                Already an affiliate? <a href="#" className="text-purple-500 hover:underline">Sign in to your dashboard</a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Frequently Asked Questions</h2>
            
            <div className="max-w-3xl mx-auto bg-white/30 rounded-lg border border-gray-200 p-6">
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
      <footer className="w-full border-t border-gray-200 py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6">
              <a 
                href="https://x.com/WagyuTech" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-400 hover:text-purple-500 transition-colors duration-300"
                aria-label="X (Twitter)"
              >
                <img 
                  src="images/x-logo.png" 
                  alt="X (Twitter)" 
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity invert"
                />
              </a>
              <a 
                href="https://www.instagram.com/wagyutech.app/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-400 hover:text-purple-500 transition-colors duration-300"
                aria-label="Instagram"
              >
                <img 
                  src="images/instagram-logo.png" 
                  alt="Instagram" 
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity"
                />
              </a>
              <a href="/affiliates" className="text-purple-500 transition-colors duration-300">Become An Affiliate</a>
              <a href="/terms" className="text-gray-400 hover:text-purple-500 transition-colors duration-300">Terms</a>
              <a href="/privacy" className="text-gray-400 hover:text-purple-500 transition-colors duration-300">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-purple-500 transition-colors duration-300">Contact</a>
            </div>
            <p className="text-gray-500 text-base font-bold">© 2024 0nyx. All rights reserved.</p>
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