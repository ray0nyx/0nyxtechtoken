import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Web3GridBackground from '@/components/ui/Web3GridBackground';
import WagyuLoader from '../components/WagyuLoader';
import { UserDropdown } from '@/components/ui/user-dropdown';
import * as framerMotion from 'framer-motion';
import { AnimatePresence } from 'framer-motion';

// Create type-safe components for framer-motion compatibility
type MotionProps = {
  children?: React.ReactNode;
  className?: string;
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  onClick?: any;
  style?: any;
  [key: string]: any;
};

const FallbackMotionDiv = ({ children, ...props }: MotionProps) => <div {...props}>{children}</div>;
const MotionDiv = (framerMotion?.motion?.div ?? FallbackMotionDiv) as React.ComponentType<MotionProps>;

export default function AffiliateSignup() {
  const navigate = useNavigate();
  const supabase = createClient();

  // Loading & Auth states
  const [isLoaded, setIsLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Form fields state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    country: '',
    website: '',
    companyName: '',
    instagramUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    twitchUrl: '',
    tiktokUrl: '',
    promotionPlan: '',
    additionalInfo: '',
  });

  // Agreement checkboxes
  const [agreements, setAgreements] = useState({
    emailNotifications: false,
    termsAndConditions: false,
  });

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Initial load effects
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setAgreements({ ...agreements, [name]: checked });
  };

  // Form submission handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!agreements.emailNotifications || !agreements.termsAndConditions) {
      setError('You must agree to both the email notifications and the terms and conditions to continue.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Submit the affiliate application via Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affiliate-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          country: formData.country,
          website: formData.website,
          companyName: formData.companyName,
          instagramUrl: formData.instagramUrl,
          facebookUrl: formData.facebookUrl,
          youtubeUrl: formData.youtubeUrl,
          twitterUrl: formData.twitterUrl,
          linkedinUrl: formData.linkedinUrl,
          twitchUrl: formData.twitchUrl,
          tiktokUrl: formData.tiktokUrl,
          promotionPlan: formData.promotionPlan,
          additionalInfo: formData.additionalInfo,
          emailAgreement: agreements.emailNotifications,
          termsAgreement: agreements.termsAndConditions
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit application');
      }

      setSuccess(true);

      // Show success message and redirect
      setTimeout(() => {
        navigate('/affiliates');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateTo = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {showLoader && <WagyuLoader />}
      <Web3GridBackground />
      <div className={`flex min-h-screen flex-col bg-transparent overflow-hidden text-gray-100 ${showLoader ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>

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

            <div className="ml-auto flex items-center gap-8">
              <button onClick={() => navigate('/affiliates')} className="text-gray-400 hover:text-white transition-colors duration-300 font-medium">
                Affiliates
              </button>

              <div className="hidden md:flex items-center gap-4">
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
                <Menu className="h-6 w-6" />
              </button>
            </div>
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
        </header>

        <main className="flex-1 pt-32 pb-16 relative z-10 px-4">
          <div className="container mx-auto">
            <div className="max-w-3xl mx-auto">
              <button
                onClick={() => navigate('/affiliates')}
                className="flex items-center text-gray-400 hover:text-white w-fit mb-8 transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
                Back to Affiliate Program
              </button>

              <div className="mb-10 text-center">
                <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white">
                  Affiliate Program <span className="text-gray-400">Application</span>
                </h1>
                <div className="h-1 w-24 bg-gradient-to-r from-gray-500 to-white mx-auto rounded-full"></div>
              </div>

              {success ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-2xl p-8 text-center shadow-2xl">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4 text-white">Application Submitted Successfully!</h2>
                  <p className="text-gray-300 text-lg">Thank you for your interest in the 0nyx Affiliate Program. We'll review your application and get back to you within 3-5 business days.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                  {/* Glowing effect */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-500 via-white to-gray-500 opacity-50"></div>

                  <div className="text-center mb-10 pb-6 border-b border-white/5">
                    <p className="text-lg text-gray-300">Fill out the form below to apply for the 0nyx Affiliate Program</p>
                  </div>

                  {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3">
                      <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* First Name */}
                    <div>
                      <label htmlFor="firstName" className="block mb-2 font-medium text-sm text-gray-400">
                        First Name <span className="text-white">*</span>
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        placeholder="John"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label htmlFor="lastName" className="block mb-2 font-medium text-sm text-gray-400">
                        Last Name <span className="text-white">*</span>
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        placeholder="Doe"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block mb-2 font-medium text-sm text-gray-400">
                        Email <span className="text-white">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter your email"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="password" className="block mb-2 font-medium text-sm text-gray-400">
                        Password <span className="text-white">*</span>
                      </label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter your password"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Country */}
                    <div>
                      <label htmlFor="country" className="block mb-2 font-medium text-sm text-gray-400">
                        Country
                      </label>
                      <select
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white transition-colors"
                      >
                        <option value="">Please select a country</option>
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="UK">United Kingdom</option>
                        <option value="AU">Australia</option>
                        {/* Add more countries as needed */}
                      </select>
                    </div>

                    {/* Website */}
                    <div>
                      <label htmlFor="website" className="block mb-2 font-medium text-sm text-gray-400">
                        Website <span className="text-white">*</span>
                      </label>
                      <input
                        type="url"
                        id="website"
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        required
                        placeholder="https://example.com"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Company Name */}
                    <div>
                      <label htmlFor="companyName" className="block mb-2 font-medium text-sm text-gray-400">
                        Company Name
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        placeholder="Example Inc."
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Social Media URLs */}
                  <h3 className="text-xl font-bold mb-6 border-b border-white/5 pb-2 text-white">Social Media Profiles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Instagram URL */}
                    <div>
                      <label htmlFor="instagramUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        Instagram URL
                      </label>
                      <input
                        type="url"
                        id="instagramUrl"
                        name="instagramUrl"
                        value={formData.instagramUrl}
                        onChange={handleInputChange}
                        placeholder="Enter Instagram URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Facebook URL */}
                    <div>
                      <label htmlFor="facebookUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        Facebook URL
                      </label>
                      <input
                        type="url"
                        id="facebookUrl"
                        name="facebookUrl"
                        value={formData.facebookUrl}
                        onChange={handleInputChange}
                        placeholder="Enter Facebook URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Youtube URL */}
                    <div>
                      <label htmlFor="youtubeUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        Youtube URL
                      </label>
                      <input
                        type="url"
                        id="youtubeUrl"
                        name="youtubeUrl"
                        value={formData.youtubeUrl}
                        onChange={handleInputChange}
                        placeholder="Enter Youtube URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Twitter URL */}
                    <div>
                      <label htmlFor="twitterUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        Twitter URL
                      </label>
                      <input
                        type="url"
                        id="twitterUrl"
                        name="twitterUrl"
                        value={formData.twitterUrl}
                        onChange={handleInputChange}
                        placeholder="Enter Twitter URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* LinkedIn URL */}
                    <div>
                      <label htmlFor="linkedinUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        LinkedIn URL
                      </label>
                      <input
                        type="url"
                        id="linkedinUrl"
                        name="linkedinUrl"
                        value={formData.linkedinUrl}
                        onChange={handleInputChange}
                        placeholder="Enter LinkedIn URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Twitch URL */}
                    <div>
                      <label htmlFor="twitchUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        Twitch URL
                      </label>
                      <input
                        type="url"
                        id="twitchUrl"
                        name="twitchUrl"
                        value={formData.twitchUrl}
                        onChange={handleInputChange}
                        placeholder="Enter Twitch URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* TikTok URL */}
                    <div className="md:col-span-2">
                      <label htmlFor="tiktokUrl" className="block mb-2 font-medium text-sm text-gray-400">
                        TikTok URL
                      </label>
                      <input
                        type="url"
                        id="tiktokUrl"
                        name="tiktokUrl"
                        value={formData.tiktokUrl}
                        onChange={handleInputChange}
                        placeholder="Enter TikTok URL"
                        className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mb-8">
                    <label htmlFor="promotionPlan" className="block mb-2 font-medium text-sm text-gray-400">
                      How will you promote 0nyx? <span className="text-white">*</span>
                    </label>
                    <textarea
                      id="promotionPlan"
                      name="promotionPlan"
                      value={formData.promotionPlan}
                      onChange={handleInputChange}
                      required
                      rows={4}
                      placeholder="Please mention any relevant links and info here so we can approve your affiliate account :). Include your blog page, discord community, etc."
                      className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                    ></textarea>
                    <p className="mt-2 text-xs text-gray-500">Please mention any relevant links and info here so we can approve your affiliate account :). Include your blog page, discord community, etc.</p>
                  </div>

                  <div className="mb-8">
                    <label htmlFor="additionalInfo" className="block mb-2 font-medium text-sm text-gray-400">
                      Is there anything else you would like to share with us? <span className="text-white">*</span>
                    </label>
                    <textarea
                      id="additionalInfo"
                      name="additionalInfo"
                      value={formData.additionalInfo}
                      onChange={handleInputChange}
                      required
                      rows={4}
                      className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-gray-500 text-white placeholder-gray-600 transition-colors"
                    ></textarea>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="emailNotifications"
                        name="emailNotifications"
                        checked={agreements.emailNotifications}
                        onChange={handleCheckboxChange}
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-black/50 text-gray-500 focus:ring-gray-500 focus:ring-offset-0"
                      />
                      <label htmlFor="emailNotifications" className="ml-3 block text-sm text-gray-300">
                        I agree to receive email notifications (like when I earn a commission) and other important emails regarding the affiliate program <span className="text-white">*</span>
                      </label>
                    </div>

                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="termsAndConditions"
                        name="termsAndConditions"
                        checked={agreements.termsAndConditions}
                        onChange={handleCheckboxChange}
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-black/50 text-gray-500 focus:ring-gray-500 focus:ring-offset-0"
                      />
                      <label htmlFor="termsAndConditions" className="ml-3 block text-sm text-gray-300">
                        I agree to <button
                          type="button"
                          onClick={() => window.open('/affiliate-terms', '_blank')}
                          className="text-white underline hover:text-gray-200 transition-colors"
                        >
                          affiliate terms & conditions
                        </button> <span className="text-white">*</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 text-black font-bold text-lg bg-[#e2e2e3] hover:bg-white rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Sign Up'
                    )}
                  </button>

                  <div className="mt-6 text-center text-sm text-gray-400">
                    Already have an account? <a href="/signin" className="text-white hover:underline">Sign In</a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-white/5 py-8 bg-black/40 backdrop-blur-md">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-gray-500 text-sm">© 2026 0nyx. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
