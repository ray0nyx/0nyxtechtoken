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
import Web3GridBackground from '@/components/ui/Web3GridBackground';

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
      <Web3GridBackground />
      <div className={`flex min-h-screen flex-col bg-transparent overflow-hidden ${showLoader ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>

        {/* Animated background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px]"></div>
        </div>

        {/* Fixed header */}
        <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'}`}>
          <div className="container mx-auto flex items-center justify-between h-20 px-4 sm:px-6">
            <a onClick={() => navigateTo('/')} className="cursor-pointer flex items-center relative h-16 w-64">
              <img src="/images/ot white.svg" alt="0nyxTech Logo" className="h-64 w-auto absolute left-0 top-1/2 -translate-y-1/2" />
            </a>

            <div className="hidden md:flex items-center justify-center flex-1">
              <nav className="flex items-center space-x-12">
                {/* Center nav content moved as per user request */}
              </nav>
            </div>

            <div className="ml-auto flex items-center gap-8">
              <button onClick={() => navigate('/affiliates')} className="text-gray-400 hover:text-white transition-colors duration-300 font-medium">
                Affiliates
              </button>

              <div className="flex items-center gap-4">
                {/* Landing: Sign In button */}
                {isAuthenticated ? (
                  <UserDropdown />
                ) : (
                  <>
                    <button onClick={() => navigate('/signin')} className="text-gray-400 hover:text-white transition-colors duration-300 font-medium">
                      Sign In
                    </button>
                    <button onClick={() => navigate('/signup')} className="bg-[#e2e2e3] hover:bg-white text-black px-8 py-2.5 rounded-lg transition-all duration-300 font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="md:hidden ml-4">
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-white focus:outline-none"
                onClick={() => setMobileMenuOpen(true)}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div> {/* Closing the container div */}

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
                  className="fixed right-0 top-0 h-full w-[300px] max-w-[85vw] bg-[#0b0b0f] border-l border-white/5 shadow-2xl z-[101] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    touchAction: 'pan-y',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain'
                  }}
                >
                  <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
                    <img src="/images/ot white.svg" alt="Logo" className="h-40 w-auto" />
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-gray-400 hover:text-white p-2 -mr-2"
                      aria-label="Close menu"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <nav className="flex flex-col gap-0 overflow-y-auto flex-1 px-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <button
                      onClick={() => { navigate('/affiliates'); setMobileMenuOpen(false); }}
                      className="py-4 text-left text-gray-400 hover:text-white border-b border-white/5 font-medium transition-colors"
                    >
                      Affiliates
                    </button>
                    {!isAuthenticated && (
                      <>
                        <button
                          onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }}
                          className="py-4 text-left text-gray-400 hover:text-white border-b border-white/5 font-medium transition-colors"
                        >
                          Sign In
                        </button>
                        <button
                          onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }}
                          className="mt-6 w-full py-4 text-center rounded-lg font-bold bg-[#e2e2e3] text-black transition-all hover:bg-white"
                        >
                          Sign Up
                        </button>
                      </>
                    )}
                  </nav>
                </MotionDiv>
              </>
            )}
          </AnimatePresence>
        </header >

        <main className="flex-1 pt-20 relative z-10">

          {/* Hero Section */}
          <section className="w-full min-h-[85vh] flex items-center py-16 md:py-24 relative overflow-hidden">
            <div className="container mx-auto px-4 relative z-10">
              <div className={`flex flex-col items-center text-center gap-6 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-5xl text-white">
                  <span>Stop Trading </span>
                  <span className="text-gray-400">Blind</span>
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Quantify Every Trade</span>
                </h1>

                {/* Subheadline */}
                <p className="max-w-2xl text-gray-400 text-lg md:text-xl leading-relaxed">
                  The only professional journal that correlates your discipline to <span className="text-white font-semibold">finality speed</span> and <span className="text-white font-semibold">execution costs</span> for Solana, Bitcoin & Futures trading.
                </p>

                {/* Pricing highlight with free trial */}
                <div className="bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl rounded-xl px-6 py-3 text-white font-bold text-lg">
                  🎉 Start Your <span className="underline">14-Day Free Trial</span> - No Credit Card Required!
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <button
                    onClick={() => navigate('/signup')}
                    className="group px-10 py-4 text-lg font-bold bg-[#e2e2e3] text-black rounded-xl hover:bg-white transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                  >
                    Sign Up
                    <ArrowUpRight className="ml-2 h-5 w-5 inline transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </button>
                </div>

                {/* Trial benefits */}
                <p className="text-sm text-gray-500 mt-4">
                  ✓ 14-day free trial • ✓ Cancel anytime • ✓ No credit card required until trial ends
                </p>

                {/* Trust indicators */}
                <div className="flex flex-wrap items-center justify-center gap-8 mt-10 text-gray-500 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-white/50" />
                    <span>Bank-grade encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-white/50" />
                    <span>Real-time analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-white/50" />
                    <span>Non-custodial</span>
                  </div>
                </div>

                {/* Hero Image */}
                <div className="w-full max-w-5xl mt-12 relative">
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-3xl shadow-white/5 hover:border-white/20 transition-all duration-500">
                    <img
                      src="/images/demos/landing-page.png"
                      alt="0nyx Trading Dashboard"
                      className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Supported Platforms Section - Infinite Carousel */}
          <section className="w-full py-20 bg-black/40 border-y border-white/5 overflow-hidden backdrop-blur-sm">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h3 className="text-2xl font-bold text-white mb-2">Seamlessly Connect Your Favorite Platforms</h3>
                <p className="text-gray-400">Import trades from Crypto Exchanges, DEXs, Futures & Stock Brokers</p>
              </div>

              {/* Infinite Scrolling Carousel */}
              <div className="relative">
                {/* Gradient masks for smooth edges */}
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none"></div>

                {/* Scrolling container */}
                <div className="flex overflow-hidden">
                  <div className="flex animate-scroll gap-8 py-4">
                    {/* First set of platforms */}
                    {supportedPlatforms.map((platform, index) => (
                      <div
                        key={`first-${platform.name}-${index}`}
                        className="group flex flex-col items-center gap-3 flex-shrink-0"
                      >
                        <div className={`w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-300
                          ${platform.category === 'crypto' ? 'group-hover:border-amber-400/50 group-hover:bg-amber-400/5' : ''}
                          ${platform.category === 'dex' || platform.category === 'wallet' ? 'group-hover:border-purple-400/50 group-hover:bg-purple-400/5' : ''}
                          ${platform.category === 'broker' ? 'group-hover:border-emerald-400/50 group-hover:bg-emerald-400/5' : ''}
                          ${platform.category === 'futures' ? 'group-hover:border-blue-400/50 group-hover:bg-blue-400/5' : ''}
                          group-hover:shadow-2xl group-hover:scale-110`}
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
                        className="group flex flex-col items-center gap-3 flex-shrink-0"
                      >
                        <div className={`w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-300
                          ${platform.category === 'crypto' ? 'group-hover:border-amber-400/50 group-hover:bg-amber-400/5' : ''}
                          ${platform.category === 'dex' || platform.category === 'wallet' ? 'group-hover:border-purple-400/50 group-hover:bg-purple-400/5' : ''}
                          ${platform.category === 'broker' ? 'group-hover:border-emerald-400/50 group-hover:bg-emerald-400/5' : ''}
                          ${platform.category === 'futures' ? 'group-hover:border-blue-400/50 group-hover:bg-blue-400/5' : ''}
                          group-hover:shadow-2xl group-hover:scale-110`}
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
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs mt-10">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Crypto Exchanges
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/20">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  DEX & Wallets
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Stock Brokers
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
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
          <section className="w-full py-24 bg-black/60 border-b border-white/5">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center mb-16">
                <div className="inline-flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-full px-4 py-2 text-red-400 text-sm font-medium mb-6 backdrop-blur-md">
                  <AlertTriangle className="w-4 h-4" />
                  The Hidden Cost of Emotional Trading
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Don't Let the Next <span className="text-red-500">Liquidation</span> Wipe Your Account
                </h2>
                <p className="text-lg text-gray-400">
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
          <section ref={featuresRef} className="w-full py-24 bg-transparent">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Everything You Need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Trade Smarter</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">
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
                    className="group relative p-8 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden backdrop-blur-sm"
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
                    <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </MotionDiv>
                ))}
              </div>
            </div>
          </section>

          {/* Analytics Showcase Section */}
          <section className="w-full py-24 bg-black/60 border-y border-white/5">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                  {/* Left side - Content */}
                  <div className="space-y-8">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-gray-300 text-sm font-medium">
                      <BarChart2 className="w-4 h-4 text-purple-400" />
                      Advanced Analytics
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white">
                      See Your Trading <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Performance</span> Like Never Before
                    </h2>
                    <p className="text-lg text-gray-400 leading-relaxed">
                      Track every metric that matters. From daily P&L to win rates, drawdowns to profit factors - all in one beautiful dashboard.
                    </p>
                    <ul className="space-y-5">
                      {[
                        'Real-time P&L tracking with calendar heatmaps',
                        'Win rate, profit factor & Sharpe ratio analysis',
                        'Trade distribution by time, day, and asset',
                        'Drawdown analysis and risk metrics'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-4 text-gray-300">
                          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate('/signup')}
                      className="px-8 py-4 bg-[#e2e2e3] text-black font-bold rounded-xl hover:bg-white transition-all duration-300 shadow-xl"
                    >
                      Sign Up Now
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
          <section className="w-full py-24 bg-transparent">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                  {/* Left side - Image */}
                  <div className="relative order-2 lg:order-1">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-3xl shadow-white/5">
                      <img
                        src="/images/demos/advanced-backtesting-platform.png"
                        alt="0nyx Advanced Backtesting Platform"
                        className="w-full h-auto grayscale-[0.2]"
                      />
                    </div>
                  </div>

                  {/* Right side - Content */}
                  <div className="space-y-8 order-1 lg:order-2">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-gray-300 text-sm font-medium">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Strategy Backtesting
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white">
                      Test Your Strategies on <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Historical Data</span>
                    </h2>
                    <p className="text-lg text-gray-400 leading-relaxed">
                      Validate your trading strategies before risking real capital. Backtest on SOL, BTC, ETH, and futures contracts with professional-grade analytics.
                    </p>
                    <ul className="space-y-5">
                      {[
                        'Pre-built strategy templates (Momentum, Mean Reversion, Trend)',
                        'Python code editor for custom algorithms',
                        'Comprehensive metrics: Sharpe, Sortino, Max Drawdown',
                        'Support for crypto (SOL, BTC, ETH) and futures (ES, NQ, CL)'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-4 text-gray-300">
                          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate('/signup')}
                      className="px-8 py-4 bg-[#e2e2e3] text-black font-bold rounded-xl hover:bg-white transition-all duration-300"
                    >
                      Sign Up Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Journal Showcase Section */}
          <section className="w-full py-24 bg-black/60 border-t border-white/5">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                  {/* Left side - Content */}
                  <div className="space-y-8">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-gray-300 text-sm font-medium">
                      <FileText className="w-4 h-4 text-amber-400" />
                      Trade Journaling
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white">
                      Document Every Trade, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Learn From Every Mistake</span>
                    </h2>
                    <p className="text-lg text-gray-400 leading-relaxed">
                      The most successful traders keep detailed journals. 0nyx makes it easy to document your thought process, emotions, and lessons learned.
                    </p>
                    <ul className="space-y-5">
                      {[
                        'Rich text editor with screenshots and charts',
                        'Tag trades by setup, emotion, and outcome',
                        'Link journal entries directly to trades',
                        'Review past entries to identify patterns'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-4 text-gray-300">
                          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate('/signup')}
                      className="px-8 py-4 bg-[#e2e2e3] text-black font-bold rounded-xl hover:bg-white transition-all duration-300"
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
          <section ref={testimonialsRef} className="w-full py-24 bg-transparent">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Trusted by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2e2e3] to-white">Serious Traders</span>
                </h2>
                <p className="text-lg text-gray-400">Real results from real traders</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
                    className="p-8 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 rounded-full ${testimonial.color} flex items-center justify-center shadow-lg shadow-black/20`}>
                        <span className="text-white font-bold text-lg">{testimonial.avatar}</span>
                      </div>
                      <div>
                        <p className="font-bold text-white">{testimonial.name}</p>
                        <p className="text-sm text-gray-400">{testimonial.role}</p>
                      </div>
                      <div className="ml-auto">
                        <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                          <Check className="w-3 h-3 text-blue-400" />
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-300 mb-6 italic leading-relaxed">"{testimonial.quote}"</p>

                    <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-400/10 w-fit px-3 py-1 rounded-full text-sm">
                      <TrendingUp className="w-4 h-4" />
                      <span>{testimonial.metric}</span>
                    </div>
                  </MotionDiv>
                ))}
              </div>

              <div className="text-center mt-12">
                <p className="text-gray-400">
                  <span className="text-2xl font-bold text-white">10,000+</span> traders are already using 0nyx
                </p>
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section ref={ctaRef} className="w-full py-24 bg-transparent relative overflow-hidden">
            <div className="container mx-auto px-4 relative z-10">
              <MotionDiv
                initial="hidden"
                animate={ctaInView ? "visible" : "hidden"}
                variants={fadeInUpVariants}
                className="max-w-4xl mx-auto text-center bg-white/5 border border-white/10 p-12 md:p-16 rounded-3xl backdrop-blur-md shadow-2xl relative overflow-hidden"
              >
                {/* Background glow for CTA */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-purple-500/5 blur-[100px] -z-10"></div>

                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Ready to Quantify Your Trading?
                </h2>
                <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
                  Join thousands of traders who've stopped trading blind. Get started with professional analytics today.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => navigate('/signup')}
                    className="group px-10 py-5 text-xl font-bold bg-[#e2e2e3] text-black rounded-xl hover:bg-white transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                  >
                    Sign Up Now
                    <ArrowUpRight className="ml-2 h-6 w-6 inline transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </button>
                </div>
                <p className="mt-8 text-gray-500 text-sm">Professional analytics • 14-day free trial • Cancel anytime</p>
              </MotionDiv>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="w-full py-12 bg-black/80 border-t border-white/5 backdrop-blur-md relative z-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center">
                <img src="/images/ot white.svg" alt="0nyxTech Logo" className="h-40 w-auto" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-8">
                <a href="https://x.com/WagyuTech" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <img src="/images/x-logo.png" alt="X" className="h-5 w-5 opacity-60 hover:opacity-100 invert" />
                </a>
                <a href="https://www.instagram.com/wagyutech.app/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <img src="/images/instagram-logo.png" alt="Instagram" className="h-5 w-5 opacity-60 hover:opacity-100 invert" />
                </a>
                <a href="/affiliates" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Affiliates</a>
                <a href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Terms</a>
                <a href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Privacy</a>
              </div>
            </div>

            <div className="text-center mt-12 pt-8 border-t border-white/5">
              <p className="text-gray-500 text-sm">
                © 2026 0nyxTech. All rights reserved. Professional analytics for the decentralized future.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
