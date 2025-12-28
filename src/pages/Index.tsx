import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  CheckCircle, 
  Check,
  ArrowUpRight, 
  RefreshCw, 
  Zap, 
  Share2, 
  Search, 
  Play, 
  Pause, 
  Loader2,
  X,
  FileText,
  ChevronLeft, 
  ChevronRight,
  Wallet,
  TrendingUp,
  Shield,
  AlertTriangle,
  Copy,
  Bitcoin,
  Activity,
  Eye,
  Target,
  Sparkles,
  Globe,
  Lock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { UserDropdown } from '@/components/ui/user-dropdown';
import WagyuLoader from '../components/WagyuLoader';
import * as framerMotion from 'framer-motion';
import { AnimatePresence } from 'framer-motion';

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

// Animation variants
const fadeInUpVariants = {
  hidden: { opacity: 0, y: 50, transition: { duration: 0.5 } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const staggerChildren = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2, delayChildren: 0.1 } }
};

const fadeInScaleVariants = {
  hidden: { opacity: 0, scale: 0.9, transition: { duration: 0.5 } },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

// Create fallback components
const FallbackMotionDiv = ({ children, ...props }: MotionProps) => <div {...props}>{children}</div>;
const FallbackMotionSection = ({ children, ...props }: MotionProps) => <section {...props}>{children}</section>;
const FallbackMotionButton = ({ children, ...props }: MotionProps) => <button {...props}>{children}</button>;

const MotionDiv = (framerMotion?.motion?.div ?? FallbackMotionDiv) as React.ComponentType<MotionProps>;
const MotionSection = (framerMotion?.motion?.section ?? FallbackMotionSection) as React.ComponentType<MotionProps>;
const MotionButton = (framerMotion?.motion?.button ?? FallbackMotionButton) as React.ComponentType<MotionProps>;

// Custom useInView hook
function useCustomInView<T extends HTMLElement>(options = { threshold: 0.1 }) {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [options.threshold]);

  return [ref, isInView] as const;
}

// Supported platforms - Crypto exchanges & Traditional brokers
const supportedPlatforms = [
  // Crypto Exchanges
  { name: 'Binance', logo: '/images/Binance-Logo.png', category: 'crypto' },
  { name: 'Coinbase', logo: '/images/logos/coinbase-logo.png', category: 'crypto' },
  { name: 'Kraken', logo: '/images/logos/kraken-logo.png', category: 'crypto' },
  { name: 'Bybit', logo: '/images/Bybit-Logo.png', category: 'crypto' },
  { name: 'OKX', logo: '/images/OKX-Logo.png', category: 'crypto' },
  // DEX & Wallets
  { name: 'Jupiter', logo: '/images/Jupiter-Logo.png', category: 'dex' },
  { name: 'Phantom', logo: '/images/Phantom-Logo.png', category: 'wallet' },
  // Traditional Brokers
  { name: 'Robinhood', logo: '/images/logos/robinhood-logo.png', category: 'broker' },
  { name: 'Webull', logo: '/images/Webull-Logo.png', category: 'broker' },
  { name: 'MT5', logo: '/images/logos/mt5-logo.png', category: 'broker' },
  // Futures Platforms
  { name: 'Tradovate', logo: '/images/logos/tradovate-logo.png', category: 'futures' },
  { name: 'NinjaTrader', logo: '/images/logos/ninjatrader-logo.jpg', category: 'futures' },
  { name: 'TopstepX', logo: '/images/logos/topstep-logo.jpg', category: 'futures' },
];

// Keep backward compatibility
const cryptoExchanges = supportedPlatforms;

export default function Index() {
  const navigate = useNavigate();
  const supabase = createClient();
  const [scrolled, setScrolled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const [featuresRef, featuresInView] = useCustomInView<HTMLDivElement>({ threshold: 0.2 });
  const [statsRef, statsInView] = useCustomInView<HTMLElement>({ threshold: 0.2 });

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Re-enable body scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [mobileMenuOpen]);
  const [ctaRef, ctaInView] = useCustomInView<HTMLElement>({ threshold: 0.2 });
  const [testimonialsRef, testimonialsInView] = useCustomInView<HTMLElement>({ threshold: 0.2 });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 6);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const navigateTo = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  if (typeof window === 'undefined') return null;

  return (
    <>
      {showLoader && <WagyuLoader />}
      <div className={`flex min-h-screen flex-col bg-white overflow-hidden ${showLoader ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
        
        {/* Animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Fixed header */}
        <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm' : 'bg-white'}`}>
          <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
            <a onClick={() => navigateTo('/')} className="cursor-pointer flex items-center">
              <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
              <span className="text-gray-800 font-extrabold text-2xl">Tech</span>
            </a>

          <div className="hidden md:flex items-center justify-center flex-1">
            <nav className="flex items-center space-x-8">
                <button onClick={() => navigate('/pricing')} className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium">
                Pricing
              </button>
                <button onClick={() => navigate('/affiliates')} className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium">
                  Affiliates
              </button>
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {isAuthenticated ? (
              <UserDropdown />
            ) : (
              <>
                  <button onClick={() => navigate('/signin')} className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium">
                  Sign In
                </button>
                  <button onClick={() => navigate('/signup')} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg transition-all duration-300 font-medium">
                    Start Free Trial
                </button>
              </>
            )}
          </div>
          
            <div className="md:hidden ml-4">
            <button 
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 focus:outline-none"
              onClick={() => setMobileMenuOpen(true)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

            {/* Mobile menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <MotionDiv
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ touchAction: 'none' }}
                />
                <MotionDiv 
                  initial={{ opacity: 0, x: "100%" }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: "100%" }}
                    transition={{ duration: 0.3 }}
                    className="fixed right-0 top-0 h-full w-[300px] max-w-[85vw] bg-white border-l border-gray-200 shadow-2xl z-[101] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    touchAction: 'pan-y',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain'
                  }}
                >
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                    <span className="text-purple-500 font-extrabold text-xl">0nyx</span>
                    <button 
                      onClick={() => setMobileMenuOpen(false)} 
                      className="text-gray-500 hover:text-gray-700 p-2 -mr-2"
                      aria-label="Close menu"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <nav className="flex flex-col gap-0 overflow-y-auto flex-1 px-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <button 
                        onClick={() => { navigate('/pricing'); setMobileMenuOpen(false); }} 
                        className="py-3 text-left text-gray-600 hover:text-purple-500 border-b border-gray-200 font-medium transition-colors"
                      >
                        Pricing
                      </button>
                      <button 
                        onClick={() => { navigate('/affiliates'); setMobileMenuOpen(false); }} 
                        className="py-3 text-left text-gray-600 hover:text-purple-500 border-b border-gray-200 font-medium transition-colors"
                      >
                        Affiliates
                      </button>
                      {!isAuthenticated && (
                        <>
                          <button 
                            onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }} 
                            className="py-3 text-left text-gray-600 hover:text-purple-500 border-b border-gray-200 font-medium transition-colors"
                          >
                            Sign In
                          </button>
                          <button 
                            onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }} 
                            className="mt-4 w-full py-4 text-center rounded-lg font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white transition-all hover:from-purple-600 hover:to-purple-700"
                          >
                            Start Free Trial
                          </button>
                        </>
                      )}
                  </nav>
                </MotionDiv>
              </>
            )}
          </AnimatePresence>
          </div>
        </header>

        <main className="flex-1 pt-16 relative z-10">
          
          {/* Hero Section */}
          <section className="w-full min-h-[85vh] flex items-center py-16 md:py-24 relative overflow-hidden bg-gradient-to-b from-white to-gray-50">
            <div className="container mx-auto px-4 relative z-10">
              <div className={`flex flex-col items-center text-center gap-6 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-full px-4 py-2 text-purple-600 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Professional Crypto & Futures Trading Analytics
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-5xl text-gray-900">
                  <span>Stop Trading </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Blind</span>
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Quantify Every Trade</span>
                </h1>

                {/* Subheadline */}
                <p className="max-w-2xl text-gray-600 text-lg md:text-xl leading-relaxed">
                  The only professional journal that correlates your discipline to <span className="text-purple-600 font-semibold">finality speed</span> and <span className="text-emerald-600 font-semibold">execution costs</span> for Solana, Bitcoin & Futures trading.
                </p>

                {/* Pricing highlight with free trial */}
                <div className="bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20 rounded-xl px-6 py-3 text-white font-bold text-lg animate-pulse">
                  🎉 Start Your <span className="underline">14-Day Free Trial</span> - No Credit Card Required!
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <button 
                    onClick={() => navigate('/signup')} 
                    className="group px-8 py-4 text-lg font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
                  >
                    Start Free Trial
                    <ArrowUpRight className="ml-2 h-5 w-5 inline transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </button>
                  <button 
                    onClick={() => navigate('/pricing')} 
                    className="px-8 py-4 text-lg font-bold border-2 border-gray-300 text-gray-700 rounded-xl hover:border-purple-500 hover:text-purple-600 transition-all duration-300"
                  >
                    View Plans
                  </button>
                </div>
                
                {/* Trial benefits */}
                <p className="text-sm text-gray-500 mt-4">
                  ✓ 14-day free trial • ✓ Cancel anytime • ✓ No credit card required until trial ends
                </p>

                {/* Trust indicators */}
                <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-gray-500 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    <span>Bank-grade encryption</span>
                </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Real-time analytics</span>
                </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-500" />
                    <span>Non-custodial</span>
              </div>
            </div>

                {/* Hero Image */}
                <div className="w-full max-w-5xl mt-10 relative">
                  <div className="relative rounded-2xl overflow-hidden border-4 border-purple-500/30 shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-500">
                    <img 
                      src="/images/demos/landing-page.png" 
                      alt="0nyx Trading Dashboard"
                      className="w-full h-auto hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
                      </div>
                      </div>
                      </div>
                      </div>
          </section>

          {/* Supported Platforms Section - Infinite Carousel */}
          <section className="w-full py-16 bg-white border-y border-gray-100 overflow-hidden">
            <div className="container mx-auto px-4">
              <div className="text-center mb-10">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Seamlessly Connect Your Favorite Platforms</h3>
                <p className="text-gray-500">Import trades from Crypto Exchanges, DEXs, Futures & Stock Brokers</p>
              </div>
              
              {/* Infinite Scrolling Carousel */}
              <div className="relative">
                {/* Gradient masks for smooth edges */}
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
                
                {/* Scrolling container */}
                <div className="flex overflow-hidden">
                  <div className="flex animate-scroll gap-8 py-4">
                    {/* First set of platforms */}
                    {supportedPlatforms.map((platform, index) => (
                      <div 
                        key={`first-${platform.name}-${index}`}
                        className="group flex flex-col items-center gap-2 flex-shrink-0"
                      >
                        <div className={`w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center transition-all duration-300
                          ${platform.category === 'crypto' ? 'group-hover:border-amber-400 group-hover:bg-amber-50' : ''}
                          ${platform.category === 'dex' || platform.category === 'wallet' ? 'group-hover:border-purple-400 group-hover:bg-purple-50' : ''}
                          ${platform.category === 'broker' ? 'group-hover:border-emerald-400 group-hover:bg-emerald-50' : ''}
                          ${platform.category === 'futures' ? 'group-hover:border-blue-400 group-hover:bg-blue-50' : ''}
                          group-hover:shadow-lg group-hover:scale-110`}
                        >
                          <img 
                            src={platform.logo} 
                            alt={platform.name}
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                e.currentTarget.style.display = 'none';
                                const fallback = document.createElement('span');
                                fallback.className = 'text-2xl font-bold text-gray-400';
                                fallback.textContent = platform.name.charAt(0);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-gray-700 font-medium whitespace-nowrap">{platform.name}</span>
                      </div>
                    ))}
                    {/* Duplicate set for seamless loop */}
                    {supportedPlatforms.map((platform, index) => (
                      <div 
                        key={`second-${platform.name}-${index}`}
                        className="group flex flex-col items-center gap-2 flex-shrink-0"
                      >
                        <div className={`w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center transition-all duration-300
                          ${platform.category === 'crypto' ? 'group-hover:border-amber-400 group-hover:bg-amber-50' : ''}
                          ${platform.category === 'dex' || platform.category === 'wallet' ? 'group-hover:border-purple-400 group-hover:bg-purple-50' : ''}
                          ${platform.category === 'broker' ? 'group-hover:border-emerald-400 group-hover:bg-emerald-50' : ''}
                          ${platform.category === 'futures' ? 'group-hover:border-blue-400 group-hover:bg-blue-50' : ''}
                          group-hover:shadow-lg group-hover:scale-110`}
                        >
                          <img 
                            src={platform.logo} 
                            alt={platform.name}
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                e.currentTarget.style.display = 'none';
                                const fallback = document.createElement('span');
                                fallback.className = 'text-2xl font-bold text-gray-400';
                                fallback.textContent = platform.name.charAt(0);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-gray-700 font-medium whitespace-nowrap">{platform.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Category labels */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs mt-8">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Crypto Exchanges
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  DEX & Wallets
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Stock Brokers
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Futures Platforms
                </span>
              </div>
              
              <p className="text-center mt-6 text-gray-400 text-sm">
                + Rithmic • KuCoin • Gate.io • MEXC • And more coming soon
              </p>
            </div>
            
            {/* CSS Animation for infinite scroll */}
            <style>{`
              @keyframes scroll {
                0% {
                  transform: translateX(0);
                }
                100% {
                  transform: translateX(-50%);
                }
              }
              .animate-scroll {
                animation: scroll 30s linear infinite;
              }
              .animate-scroll:hover {
                animation-play-state: paused;
              }
            `}</style>
          </section>

          {/* Pain Point Section */}
          <section className="w-full py-20 bg-gray-50">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-red-100 border border-red-200 rounded-full px-4 py-2 text-red-600 text-sm font-medium mb-6">
                  <AlertTriangle className="w-4 h-4" />
                  The Hidden Cost of Emotional Trading
                    </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Don't Let the Next <span className="text-red-500">Liquidation</span> Wipe Your Account
                </h2>
                <p className="text-lg text-gray-600">
                  Most traders lose money because they trade their emotions, not the market. 0nyx quantifies the emotional cost of every trade.
                </p>
                </div>
                
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  { icon: Activity, title: 'Congestion Cost Index', description: 'See exactly how much network congestion is costing you on every Solana trade.', color: 'purple' },
                  { icon: Target, title: 'Liquidation Predictor', description: 'Get alerts before your position hits liquidation based on your historical patterns.', color: 'red' },
                  { icon: Eye, title: 'Behavioral Auditor', description: 'Identify emotional trading patterns that are destroying your P&L.', color: 'amber' }
                ].map((item, index) => (
                  <div 
                    key={index}
                    className="group p-6 bg-white border border-gray-200 rounded-2xl hover:border-purple-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-${item.color}-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <item.icon className={`w-6 h-6 text-${item.color}-500`} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm">{item.description}</p>
                  </div>
                ))}
                </div>
              </div>
          </section>

          {/* Features Section */}
          <section ref={featuresRef} className="w-full py-20 bg-white">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Everything You Need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Trade Smarter</span>
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Professional-grade tools built for crypto and futures traders
                </p>
                </div>
                
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {[
                  { icon: Wallet, title: 'Wallet Copy Trading', description: 'Track and analyze top Solana wallets. Get alerts when whales make moves.', gradient: 'from-purple-500 to-indigo-500', badge: 'Elite' },
                  { icon: Bitcoin, title: 'Bitcoin On-Chain Analysis', description: 'Deep dive into Bitcoin metrics, whale movements, and on-chain signals.', gradient: 'from-amber-500 to-orange-500', badge: 'Elite' },
                  { icon: TrendingUp, title: 'Advanced Backtesting', description: 'Test your strategies against historical data with volatility stress testing.', gradient: 'from-emerald-500 to-teal-500', badge: 'Pro' },
                  { icon: RefreshCw, title: 'Auto Broker Sync', description: 'Connect Binance, Bybit, OKX, Tradovate and more. Trades sync automatically.', gradient: 'from-blue-500 to-cyan-500', badge: 'Pro' },
                  { icon: BarChart2, title: 'Real-Time Analytics', description: 'Live P&L tracking, win rates, profit factors, and performance metrics.', gradient: 'from-pink-500 to-rose-500', badge: null },
                  { icon: FileText, title: 'Tax-Ready Reporting', description: 'Cross-chain P&L segregation for easy tax reporting.', gradient: 'from-violet-500 to-purple-500', badge: 'Elite' }
                ].map((feature, index) => (
              <MotionDiv 
                    key={index}
                    initial="hidden"
                    animate={featuresInView ? "visible" : "hidden"}
                    variants={{ ...fadeInScaleVariants, visible: { ...fadeInScaleVariants.visible, transition: { ...fadeInScaleVariants.visible.transition, delay: index * 0.1 } } }}
                    className="group relative p-6 bg-white border border-gray-200 rounded-2xl hover:border-purple-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                    
                    {feature.badge && (
                      <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${feature.gradient} text-white`}>
                        {feature.badge}
                  </div>
                    )}
                    
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-6 h-6 text-white" />
                  </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                </MotionDiv>
                ))}
              </div>
            </div>
          </section>

          {/* Analytics Showcase Section */}
          <section className="w-full py-20 bg-gray-50">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Left side - Content */}
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-full px-4 py-2 text-purple-600 text-sm font-medium">
                      <BarChart2 className="w-4 h-4" />
                      Advanced Analytics
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                      See Your Trading <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Performance</span> Like Never Before
                    </h2>
                    <p className="text-lg text-gray-600">
                      Track every metric that matters. From daily P&L to win rates, drawdowns to profit factors - all in one beautiful dashboard.
                    </p>
                    <ul className="space-y-4">
                      {[
                        'Real-time P&L tracking with calendar heatmaps',
                        'Win rate, profit factor & Sharpe ratio analysis',
                        'Trade distribution by time, day, and asset',
                        'Drawdown analysis and risk metrics'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-700">
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-purple-600" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button 
                      onClick={() => navigate('/pricing')}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300"
                    >
                      Start Tracking Now
                    </button>
                  </div>
                  
                  {/* Right side - Video */}
                  <div className="relative">
                    <div className="relative rounded-2xl overflow-hidden border-4 border-purple-500/30 shadow-2xl shadow-purple-500/20">
                      <video 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-auto"
                        poster="/images/demos/analytics-screenshotv2.png"
                      >
                        <source src="/images/demos/analytics-demov2.mp4" type="video/mp4" />
                        <img 
                          src="/images/demos/analytics-screenshotv2.png" 
                          alt="0nyx Analytics Dashboard"
                          className="w-full h-auto"
                        />
                      </video>
                    </div>
                    {/* Floating stats */}
                    <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500">Win Rate</p>
                      <p className="text-2xl font-bold text-emerald-500">72.4%</p>
                    </div>
                    <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500">Monthly P&L</p>
                      <p className="text-2xl font-bold text-emerald-500">+$12,450</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Backtesting Showcase Section */}
          <section className="w-full py-20 bg-white">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Left side - Image */}
                  <div className="relative order-2 lg:order-1">
                    <div className="relative rounded-2xl overflow-hidden border-4 border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                      <img 
                        src="/images/demos/advanced-backtesting-platform.png" 
                        alt="0nyx Advanced Backtesting Platform"
                        className="w-full h-auto"
                      />
                    </div>
                    {/* Floating stats */}
                    <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500">Sharpe Ratio</p>
                      <p className="text-2xl font-bold text-emerald-500">2.14</p>
                    </div>
                    <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500">Backtest Return</p>
                      <p className="text-2xl font-bold text-emerald-500">+156%</p>
                    </div>
                  </div>
                  
                  {/* Right side - Content */}
                  <div className="space-y-6 order-1 lg:order-2">
                    <div className="inline-flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-full px-4 py-2 text-emerald-600 text-sm font-medium">
                      <TrendingUp className="w-4 h-4" />
                      Strategy Backtesting
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                      Test Your Strategies on <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Historical Data</span>
                    </h2>
                    <p className="text-lg text-gray-600">
                      Validate your trading strategies before risking real capital. Backtest on SOL, BTC, ETH, and futures contracts with professional-grade analytics.
                    </p>
                    <ul className="space-y-4">
                      {[
                        'Pre-built strategy templates (Momentum, Mean Reversion, Trend)',
                        'Python code editor for custom algorithms',
                        'Comprehensive metrics: Sharpe, Sortino, Max Drawdown',
                        'Support for crypto (SOL, BTC, ETH) and futures (ES, NQ, CL)'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-700">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button 
                      onClick={() => navigate('/pricing')}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-300"
                    >
                      Start Backtesting
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Journal Showcase Section */}
          <section className="w-full py-20 bg-gray-50">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Left side - Content */}
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 bg-amber-100 border border-amber-200 rounded-full px-4 py-2 text-amber-600 text-sm font-medium">
                      <FileText className="w-4 h-4" />
                      Trade Journaling
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                      Document Every Trade, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">Learn From Every Mistake</span>
                    </h2>
                    <p className="text-lg text-gray-600">
                      The most successful traders keep detailed journals. 0nyx makes it easy to document your thought process, emotions, and lessons learned.
                    </p>
                    <ul className="space-y-4">
                      {[
                        'Rich text editor with screenshots and charts',
                        'Tag trades by setup, emotion, and outcome',
                        'Link journal entries directly to trades',
                        'Review past entries to identify patterns'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-700">
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-amber-600" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button 
                      onClick={() => navigate('/pricing')}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300"
                    >
                      Start Journaling
                    </button>
                  </div>
                  
                  {/* Right side - Image */}
                  <div className="relative">
                    <div className="relative rounded-2xl overflow-hidden border-4 border-amber-500/30 shadow-2xl shadow-amber-500/20">
                      <img 
                        src="/images/demos/trading-journal-screenshot.png" 
                        alt="0nyx Trade Journal"
                        className="w-full h-auto"
                      />
                    </div>
                    {/* Floating element */}
                    <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-500">Journal Entries</p>
                      <p className="text-2xl font-bold text-amber-500">247</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section ref={testimonialsRef} className="w-full py-20 bg-white">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Trusted by <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Serious Traders</span>
                </h2>
                <p className="text-lg text-gray-600">Real results from real traders</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  { name: 'Alex Chen', role: 'Solana Perps Trader', avatar: 'AC', color: 'bg-purple-500', quote: "I stopped getting liquidated on Drift when 0nyx showed me my Congestion Cost Index. +15% P&L in month 1.", metric: '+$47k profit' },
                  { name: 'Maria Santos', role: 'DEX Arbitrage Trader', avatar: 'MS', color: 'bg-emerald-500', quote: "The wallet tracking feature let me follow smart money. My win rate went from 38% to 72% in 2 months.", metric: '72% win rate' },
                  { name: 'James Park', role: 'Futures Swing Trader', avatar: 'JP', color: 'bg-amber-500', quote: "On-chain analysis showed me exactly when whales were accumulating. Best investment I've made for my trading.", metric: '+189% returns' }
                ].map((testimonial, index) => (
                  <MotionDiv
                    key={index}
                    initial="hidden"
                    animate={testimonialsInView ? "visible" : "hidden"}
                    variants={{ ...fadeInUpVariants, visible: { ...fadeInUpVariants.visible, transition: { ...fadeInUpVariants.visible.transition, delay: index * 0.15 } } }}
                    className="p-6 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-full ${testimonial.color} flex items-center justify-center`}>
                        <span className="text-white font-bold text-sm">{testimonial.avatar}</span>
                          </div>
                        <div>
                        <p className="font-bold text-gray-900">{testimonial.name}</p>
                        <p className="text-sm text-gray-500">{testimonial.role}</p>
                        </div>
                      <div className="ml-auto flex items-center gap-1">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        <span className="text-blue-500 text-xs">Verified</span>
                        </div>
                      </div>

                    <p className="text-gray-700 mb-4 italic">"{testimonial.quote}"</p>
                    
                    <div className="flex items-center gap-2 text-emerald-600 font-bold">
                      <TrendingUp className="w-4 h-4" />
                      <span>{testimonial.metric}</span>
                        </div>
                  </MotionDiv>
                        ))}
                      </div>

              <div className="text-center mt-10">
                <p className="text-gray-500">
                  <span className="text-2xl font-bold text-gray-900">10,000+</span> traders are already using 0nyx
                </p>
                        </div>
                        </div>
          </section>

          {/* Pricing Preview */}
          <section className="w-full py-20 bg-white">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Transparent</span> Pricing
                </h2>
                <p className="text-lg text-gray-600">Choose the plan that fits your trading needs</p>
                      </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  { name: 'Starter', price: '$19.99', description: 'Essential crypto analytics', features: ['Unlimited CSV uploads', 'SOL & BTC tracking', 'Basic analytics', 'Trade journaling'], gradient: 'from-emerald-500 to-teal-500', popular: false },
                  { name: 'Pro', price: '$39.99', description: 'Advanced analytics + sync', features: ['Everything in Starter', 'Auto broker sync', 'Advanced backtesting', 'Liquidation alerts'], gradient: 'from-purple-500 to-indigo-500', popular: true },
                  { name: 'Elite', price: '$79.99', description: 'Full suite + copy trading', features: ['Everything in Pro', 'Wallet copy trading', 'On-chain analysis', 'Tax reporting'], gradient: 'from-amber-500 to-orange-500', popular: false }
                ].map((plan, index) => (
                  <div 
                    key={index}
                    className={`relative p-6 bg-white border rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                      plan.popular ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                        MOST POPULAR
                      </div>
                    )}
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                    <div className="mb-4">
                      <span className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${plan.gradient}`}>{plan.price}</span>
                      <span className="text-gray-500">/month</span>
                  </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-gray-600 text-sm">
                          <Check className="w-4 h-4 text-emerald-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                  <button 
                      onClick={() => navigate('/pricing')}
                      className={`w-full py-3 rounded-xl font-bold transition-all duration-300 ${
                        plan.popular 
                          ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90` 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Get Started
                  </button>
                </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section ref={ctaRef} className="w-full py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
            <div className="absolute inset-0">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]"></div>
            </div>
            
            <div className="container mx-auto px-4 relative z-10">
              <MotionDiv 
                initial="hidden"
                animate={ctaInView ? "visible" : "hidden"}
                variants={fadeInUpVariants}
                className="max-w-3xl mx-auto text-center"
              >
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                  Ready to Trade with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Clarity</span>?
                </h2>
                <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                  Join thousands of crypto and futures traders who've stopped trading blind. Choose a plan that fits your trading style.
                </p>
                <button 
                  onClick={() => navigate('/pricing')} 
                  className="group px-10 py-5 text-xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
                >
                  View Plans & Get Started
                  <ArrowUpRight className="ml-2 h-6 w-6 inline transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>
                <p className="mt-6 text-gray-500 text-sm">Professional analytics • Cancel anytime</p>
              </MotionDiv>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="w-full py-8 bg-white border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-purple-500 font-extrabold text-xl">0nyx</span>
                <span className="text-gray-800 font-extrabold text-xl">Tech</span>
              </div>
              
              <div className="flex items-center gap-6">
                <a href="https://x.com/WagyuTech" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-purple-500 transition-colors">
                  <img src="images/x-logo.png" alt="X" className="h-5 w-5 opacity-60 hover:opacity-100" />
                </a>
                <a href="https://www.instagram.com/wagyutech.app/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-purple-500 transition-colors">
                  <img src="images/instagram-logo.png" alt="Instagram" className="h-5 w-5 opacity-60 hover:opacity-100" />
                </a>
                <a href="/affiliates" className="text-gray-500 hover:text-purple-500 transition-colors text-sm">Affiliates</a>
                <a href="/terms" className="text-gray-500 hover:text-purple-500 transition-colors text-sm">Terms</a>
                <a href="/privacy" className="text-gray-500 hover:text-purple-500 transition-colors text-sm">Privacy</a>
              </div>
            </div>
            
            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <p className="text-gray-400 text-sm">© {new Date().getFullYear()} 0nyx. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
