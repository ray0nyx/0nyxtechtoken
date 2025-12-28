import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AffiliateSignup() {
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white flex h-16 items-center px-6 border-b border-gray-200">
        <div className="font-extrabold text-xl relative flex items-center">
          <a href="/" className="flex items-center">
            <span className="text-purple-500 relative z-10">0nyx</span>
          </a>
          <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 via-purple-600 to-blue-500 rounded-full"></div>
        </div>
      </header>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <button 
              onClick={() => navigate('/affiliates')}
              className="flex items-center text-gray-600 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r from-purple-500 to-blue-500 mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Affiliate Program
            </button>

            <h1 className="text-3xl font-bold mb-6 text-purple-500">Affiliate Program Application</h1>
            
            {success ? (
              <div className="bg-green-100 border border-green-500 rounded-lg p-6 text-center">
                <h2 className="text-xl font-semibold mb-2 text-green-800">Application Submitted Successfully!</h2>
                <p className="text-gray-700 text-lg font-bold">Thank you for your interest in the 0nyx Affiliate Program. We'll review your application and get back to you within 3-5 business days.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-gray-50 p-8 rounded-lg border border-gray-200">
                <div className="text-center mb-6 pb-6 border-b border-gray-200">
                  <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 font-bold">Fill out the form below to apply for the 0nyx Affiliate Program</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* First Name */}
                  <div>
                    <label htmlFor="firstName" className="block mb-2 font-medium text-lg text-gray-900">
                      First Name <span className="text-purple-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="John"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label htmlFor="lastName" className="block mb-2 font-medium text-lg text-gray-900">
                      Last Name <span className="text-purple-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      placeholder="Doe"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block mb-2 font-medium text-lg text-gray-900">
                      Email <span className="text-purple-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your email"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block mb-2 font-medium text-lg text-gray-900">
                      Password <span className="text-purple-500">*</span>
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your password"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label htmlFor="country" className="block mb-2 font-medium text-lg text-gray-900">
                      Country
                    </label>
                    <select
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900"
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
                    <label htmlFor="website" className="block mb-2 font-medium text-lg text-gray-900">
                      Website <span className="text-purple-500">*</span>
                    </label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      required
                      placeholder="https://example.com"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Company Name */}
                  <div>
                    <label htmlFor="companyName" className="block mb-2 font-medium text-lg text-gray-900">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder="Example Inc."
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Social Media URLs */}
                <h3 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Social Media Profiles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Instagram URL */}
                  <div>
                    <label htmlFor="instagramUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      Instagram URL
                    </label>
                    <input
                      type="url"
                      id="instagramUrl"
                      name="instagramUrl"
                      value={formData.instagramUrl}
                      onChange={handleInputChange}
                      placeholder="Enter Instagram URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Facebook URL */}
                  <div>
                    <label htmlFor="facebookUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      Facebook URL
                    </label>
                    <input
                      type="url"
                      id="facebookUrl"
                      name="facebookUrl"
                      value={formData.facebookUrl}
                      onChange={handleInputChange}
                      placeholder="Enter Facebook URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Youtube URL */}
                  <div>
                    <label htmlFor="youtubeUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      Youtube URL
                    </label>
                    <input
                      type="url"
                      id="youtubeUrl"
                      name="youtubeUrl"
                      value={formData.youtubeUrl}
                      onChange={handleInputChange}
                      placeholder="Enter Youtube URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Twitter URL */}
                  <div>
                    <label htmlFor="twitterUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      Twitter URL
                    </label>
                    <input
                      type="url"
                      id="twitterUrl"
                      name="twitterUrl"
                      value={formData.twitterUrl}
                      onChange={handleInputChange}
                      placeholder="Enter Twitter URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* LinkedIn URL */}
                  <div>
                    <label htmlFor="linkedinUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      id="linkedinUrl"
                      name="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={handleInputChange}
                      placeholder="Enter LinkedIn URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Twitch URL */}
                  <div>
                    <label htmlFor="twitchUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      Twitch URL
                    </label>
                    <input
                      type="url"
                      id="twitchUrl"
                      name="twitchUrl"
                      value={formData.twitchUrl}
                      onChange={handleInputChange}
                      placeholder="Enter Twitch URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* TikTok URL */}
                  <div className="md:col-span-2">
                    <label htmlFor="tiktokUrl" className="block mb-2 font-medium text-lg text-gray-900">
                      TikTok URL
                    </label>
                    <input
                      type="url"
                      id="tiktokUrl"
                      name="tiktokUrl"
                      value={formData.tiktokUrl}
                      onChange={handleInputChange}
                      placeholder="Enter TikTok URL"
                      className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mb-8">
                  <label htmlFor="promotionPlan" className="block mb-2 font-medium text-lg text-gray-900">
                    How will you promote 0nyx? <span className="text-purple-500">*</span>
                  </label>
                  <textarea
                    id="promotionPlan"
                    name="promotionPlan"
                    value={formData.promotionPlan}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    placeholder="Please mention any relevant links and info here so we can approve your affiliate account :). Include your blog page, discord community, etc."
                    className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
                  ></textarea>
                  <p className="mt-1 text-base text-gray-500 font-bold">Please mention any relevant links and info here so we can approve your affiliate account :). Include your blog page, discord community, etc.</p>
                </div>

                <div className="mb-8">
                  <label htmlFor="additionalInfo" className="block mb-2 font-medium text-lg text-gray-900">
                    Is there anything else you would like to share with us? <span className="text-purple-500">*</span>
                  </label>
                  <textarea
                    id="additionalInfo"
                    name="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
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
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="emailNotifications" className="ml-2 block text-base text-gray-700 font-bold">
                      I agree to receive email notifications (like when I earn a commission) and other important emails regarding the affiliate program <span className="text-purple-500">*</span>
                    </label>
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="termsAndConditions"
                      name="termsAndConditions"
                      checked={agreements.termsAndConditions}
                      onChange={handleCheckboxChange}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="termsAndConditions" className="ml-2 block text-base text-gray-700 font-bold">
                      I agree to <button 
                        type="button" 
                        onClick={() => window.open('/affiliate-terms', '_blank')}
                        className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 underline hover:opacity-80"
                      >
                        affiliate terms & conditions
                      </button> <span className="text-purple-500">*</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </button>

                <div className="mt-4 text-center text-base text-gray-500 font-bold">
                  Already have an account? <a href="/signin" className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-80">Sign In</a>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-gray-500 text-base font-bold">© 2024 0nyx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
