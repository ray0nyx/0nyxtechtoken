import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TradovateUploadForm } from '@/components/trades/TradovateUploadForm';
import { TopstepXUploadForm } from '@/components/trades/TopstepXUploadForm';
import { RobinhoodUploadForm } from '@/components/trades/RobinhoodUploadForm';
import { WebullUploadForm } from '@/components/trades/WebullUploadForm';
import { CoinbaseUploadForm } from '@/components/trades/CoinbaseUploadForm';
import { KrakenUploadForm } from '@/components/trades/KrakenUploadForm';
import { Metatrader5UploadForm } from '@/components/trades/Metatrader5UploadForm';
import { CheckCircle, AlertCircle, Upload, BarChart3, Users, Download, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

export default function TradesAddPage() {
  const [activeSection, setActiveSection] = useState<'tradovate' | 'topstepx' | 'robinhood' | 'webull' | 'coinbase' | 'kraken' | 'metatrader5'>('tradovate');
  const { isSubscriptionValid, isDeveloper } = useSubscription();
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleTradovateOAuth = () => {
    // Generate a random state value for security
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauthState', state);
    localStorage.setItem('selectedBroker', 'Tradovate');

    // Construct the OAuth URL with necessary parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_TRADOVATE_CLIENT_ID || '',
      redirect_uri: `${window.location.origin}/auth/callback`,
      state: state,
      scope: 'trade_data read_accounts',
    });

    // Redirect to Tradovate's OAuth page
    window.location.href = `https://live.tradovate.com/oauth/authorize?${params.toString()}`;
  };


  return (
    <div className="bg-gray-50 dark:bg-[#0a0a0a] min-h-screen">
      <div className="container mx-auto py-8 px-4 pb-16">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-200">Upload Your Trades</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Import your trading data from CSV files and get detailed analytics, performance insights, and professional reports.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="flex justify-center mb-8">
          <div className="flex flex-wrap gap-8">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Upload className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium">Secure CSV Upload</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <BarChart3 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium">Real-time Analysis</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium">Multi-Platform Support</span>
            </div>
          </div>
        </div>



        {/* Platform Selection */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'tradovate'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('tradovate')}
          >
            Tradovate
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'topstepx'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('topstepx')}
          >
            TopstepX
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'robinhood'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('robinhood')}
          >
            Robinhood
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'webull'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('webull')}
          >
            Webull
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'coinbase'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('coinbase')}
          >
            Coinbase
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'kraken'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('kraken')}
          >
            Kraken
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-all ${activeSection === 'metatrader5'
              ? 'bg-gray-200 text-gray-900 border border-gray-300 shadow-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
              : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-gray-700'
              }`}
            onClick={() => setActiveSection('metatrader5')}
          >
            Metatrader5
          </button>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
          {/* Left Column - Upload Section */}
          <div className="space-y-6">
            <Card className="shadow-lg bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Upload className="h-5 w-5" />
                  Upload CSV File
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                {activeSection === 'tradovate' && <TradovateUploadForm directUpload={true} />}
                {activeSection === 'topstepx' && <TopstepXUploadForm directUpload={true} />}
                {activeSection === 'robinhood' && <RobinhoodUploadForm directUpload={true} />}
                {activeSection === 'webull' && <WebullUploadForm directUpload={true} />}
                {activeSection === 'coinbase' && <CoinbaseUploadForm directUpload={true} />}
                {activeSection === 'kraken' && <KrakenUploadForm directUpload={true} />}
                {activeSection === 'metatrader5' && <Metatrader5UploadForm directUpload={true} />}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Information Cards */}
          <div className="space-y-6">
            {/* Direct Upload Mode Card */}
            <Card className="shadow-lg bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <span className="text-gray-900 dark:text-white">Direct Upload Mode</span>
                  <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700">Recommended</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Your trades will be uploaded directly without requiring account selection. A default account will be created for you automatically if needed.
                </p>
              </CardContent>
            </Card>

            {/* Platform Format Card */}
            <Card className="shadow-lg bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <Upload className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  {activeSection === 'tradovate' && 'Tradovate CSV Format'}
                  {activeSection === 'topstepx' && 'TopstepX CSV Format'}
                  {activeSection === 'robinhood' && 'Robinhood CSV Format'}
                  {activeSection === 'webull' && 'Webull CSV Format'}
                  {activeSection === 'coinbase' && 'Coinbase CSV Format'}
                  {activeSection === 'kraken' && 'Kraken CSV Format'}
                  {activeSection === 'metatrader5' && 'Metatrader5 CSV Format'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300">
                  {activeSection === 'tradovate' && "This uploader is specifically designed for Tradovate CSV exports. Please ensure your CSV file has the following columns:"}
                  {activeSection === 'topstepx' && "This uploader is designed for TopstepX 'Trades' export (not 'Orders'). Go to History → Trades → Export to CSV."}
                  {activeSection === 'robinhood' && "This uploader is designed for Robinhood CSV exports. Please ensure your CSV file has the required columns."}
                  {activeSection === 'webull' && "This uploader is designed for Webull CSV exports. The system will automatically pair your entry and exit trades."}
                  {activeSection === 'coinbase' && "Coming Soon - Support for Coinbase CSV exports will be available soon!"}
                  {activeSection === 'kraken' && "Coming Soon - Support for Kraken CSV exports will be available soon!"}
                  {activeSection === 'metatrader5' && "Coming Soon - Support for Metatrader5 CSV exports will be available soon!"}
                </p>

                {activeSection === 'tradovate' && (
                  <>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Required Columns:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Fill Time</Badge>
                        <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Text</Badge>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Optional Columns:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">filledQty</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">avgPrice</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">B/S</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">Contract</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">Product</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">orderId</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">priceFormat</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">tickSize</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">buyPrice</Badge>
                        <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">sellPrice</Badge>
                      </div>
                    </div>
                  </>
                )}

                {/* Expandable Sections */}
                <div className="space-y-3 pb-4">
                  <button
                    onClick={() => toggleSection('sample')}
                    className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">View Sample CSV Format</span>
                    </div>
                    {expandedSections.sample ? <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                  </button>
                  {expandedSections.sample && (
                    <div className="p-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-600 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Download a sample CSV file to see the exact format required:</p>
                      <Button variant="outline" className="w-full border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                        <Download className="h-4 w-4 mr-2" />
                        Download Sample CSV
                      </Button>
                    </div>
                  )}

                  <button
                    onClick={() => toggleSection('export')}
                    className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">How to Export from {activeSection === 'tradovate' ? 'Tradovate' : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</span>
                    </div>
                    {expandedSections.export ? <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                  </button>
                  {expandedSections.export && (
                    <div className="p-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-600 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {activeSection === 'tradovate' && "1. Log into your Tradovate account\n2. Go to Reports → Trade History\n3. Select your date range\n4. Click 'Export to CSV'\n5. Download the file and upload it here"}
                        {activeSection !== 'tradovate' && "Export instructions will be available when this platform is fully supported."}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => toggleSection('troubleshooting')}
                    className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Troubleshooting</span>
                    </div>
                    {expandedSections.troubleshooting ? <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                  </button>
                  {expandedSections.troubleshooting && (
                    <div className="p-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <p><strong>Common Issues:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Ensure your CSV file has the required columns</li>
                          <li>Check that dates are in the correct format</li>
                          <li>Verify that numeric values don't contain currency symbols</li>
                          <li>Make sure the file is not password protected</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
} 