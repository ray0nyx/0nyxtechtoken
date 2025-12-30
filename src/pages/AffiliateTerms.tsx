import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { affiliateTerms } from '@/data/affiliateTerms';

export default function AffiliateTerms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white flex h-16 items-center px-6 border-b border-gray-200">
        <div className="font-extrabold text-xl relative flex items-center">
          <a href="/" className="flex items-center">
            <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-purple-600 to-blue-500">Affiliate Terms</span>
          </a>
          <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 via-purple-600 to-blue-500 rounded-full"></div>
        </div>
      </header>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => navigate('/affiliate-signup')}
              className="flex items-center text-gray-600 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r from-purple-500 to-blue-500 mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Signup
            </button>

            <div className="bg-gray-50 p-8 rounded-lg border border-gray-200">
              <h1 className="text-3xl font-bold mb-8 text-center text-purple-500">Affiliate Terms & Conditions</h1>

              <div className="prose prose-gray max-w-none">
                <div dangerouslySetInnerHTML={{ __html: affiliateTerms.replace(/\n/g, '<br />') }} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer with subtle animation */}
      <footer className="w-full py-8 bg-white border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6">
              <a
                href="https://x.com/0nyxTech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-purple-500 transition-colors duration-300"
                aria-label="X (Twitter)"
              >
                <img
                  src="images/x-logo.png"
                  alt="X (Twitter)"
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity"
                />
              </a>
              <a
                href="https://discord.gg/xq5XFHBZ8j"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-purple-500 transition-colors duration-300"
                aria-label="Discord"
              >
                <img
                  src="/icons/discord.svg"
                  alt="Discord"
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity"
                />
              </a>
              <a
                href="https://www.instagram.com/0nyxtech.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-purple-500 transition-colors duration-300"
                aria-label="Instagram"
              >
                <img
                  src="images/instagram-logo.png"
                  alt="Instagram"
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity"
                />
              </a>
              <a href="/affiliates" className="text-purple-500 hover:text-purple-600 transition-colors duration-300">Become An Affiliate</a>
              <a href="/terms" className="text-gray-600 hover:text-purple-500 transition-colors duration-300">Terms</a>
              <a href="/privacy" className="text-gray-600 hover:text-purple-500 transition-colors duration-300">Privacy</a>
              <a href="#" className="text-gray-600 hover:text-purple-500 transition-colors duration-300">Contact</a>
            </div>
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 