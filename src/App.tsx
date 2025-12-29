import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { OfflineSyncProvider } from '@/providers/OfflineSyncProvider';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { UserProvider } from '@/lib/UserContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AffiliateGuard } from '@/components/auth/AffiliateGuard';
import { FeatureAccessGuard } from '@/components/guards/FeatureAccessGuard';
import RecoveryInterceptor from '@/components/auth/RecoveryInterceptor';

// Components (keep these eager - they're small and used everywhere)
import { RootRedirect } from '@/components/RootRedirect';
import { SimpleAppGuard } from '@/components/SimpleAppGuard';
import PasswordResetHandler from '@/components/auth/PasswordResetHandler';
import AppLayout from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';

// Keep critical pages eager for fast initial load
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';
import Index from '@/pages/Index';
import Pricing from '@/pages/Pricing';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import SubscriptionPage from '@/pages/subscription/SubscriptionPage';
import Analytics from '@/pages/analytics/Analytics';
import Trades from '@/pages/trades/Trades';
import AddTrade from '@/pages/trades/add';
import Performance from '@/pages/Performance';
import Journal from '@/pages/journal/Journal';
import Settings from '@/pages/Settings';
import Leaderboard from '@/pages/Leaderboard';
import Backtesting from '@/pages/Backtesting';

// Lazy load heavy/less-used pages
const TestApp = lazy(() => import('@/pages/TestApp'));
const DeveloperDashboard = lazy(() => import('@/pages/admin/DeveloperDashboard'));
const Algo = lazy(() => import('@/pages/Algo'));
const CopyTrader = lazy(() => import('@/pages/CopyTrader'));
const QuantDashboard = lazy(() => import('@/pages/quant/Dashboard'));
const QuantAlgorithms = lazy(() => import('@/pages/quant/Algorithms'));
const QuantAlgorithmEditor = lazy(() => import('@/pages/quant/AlgorithmEditor'));
const QuantBacktestAnalysis = lazy(() => import('@/pages/quant/BacktestAnalysis'));
const QuantBacktestReport = lazy(() => import('@/pages/quant/BacktestReport'));
const QuantOptimization = lazy(() => import('@/pages/quant/Optimization'));
const QuantDeployment = lazy(() => import('@/pages/quant/Deployment'));
const QuantEquityChart = lazy(() => import('@/pages/quant/EquityChart'));
const Affiliates = lazy(() => import('@/pages/Affiliates'));
const AffiliateSignup = lazy(() => import('@/pages/AffiliateSignup'));
const AffiliateTerms = lazy(() => import('@/pages/AffiliateTerms'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AuthCallback = lazy(() => import('@/pages/auth/callback'));
const Marketplace = lazy(() => import('@/pages/marketplace/Marketplace'));
const CreateProduct = lazy(() => import('@/pages/marketplace/CreateProduct'));
const SellerDashboard = lazy(() => import('@/pages/marketplace/SellerDashboard'));
const PasswordResetDebug = lazy(() => import('@/pages/debug/PasswordResetDebug'));
const PasswordResetDiagnostic = lazy(() => import('@/components/debug/PasswordResetDiagnostic'));
const URLDebugger = lazy(() => import('@/pages/debug/URLDebugger'));
const WagyuTechLiveTrading = lazy(() => import('@/pages/WagyuTechLiveTrading'));
const Reports = lazy(() => import('@/pages/reports/Reports'));
const AllJournalEntries = lazy(() => import('./pages/journal/AllEntries'));
const FundamentalData = lazy(() => import('@/pages/FundamentalData'));
const AffiliateDashboard = lazy(() => import('@/pages/affiliate/AffiliateDashboard'));
const PLStatements = lazy(() => import('@/pages/PLStatements'));
const CryptoAnalytics = lazy(() => import('@/pages/crypto/CryptoAnalytics'));
const APIKeys = lazy(() => import('@/pages/api/Keys'));
const CryptoDashboard = lazy(() => import('@/pages/crypto/Dashboard'));
const CryptoWallets = lazy(() => import('@/pages/crypto/Wallets'));
const CopyTradingPage = lazy(() => import('@/pages/crypto/CopyTradingPage'));
const OnChainAnalysisPage = lazy(() => import('@/pages/crypto/OnChainAnalysis'));
const TokensPage = lazy(() => import('@/pages/crypto/Tokens'));
const AxiomSurgePage = lazy(() => import('@/pages/crypto/AxiomSurgePage'));
const ExplorePage = lazy(() => import('@/pages/crypto/ExplorePage'));
const SolNavigator = lazy(() => import('@/pages/crypto/SolNavigator'));
const EnhancedChartDemo = lazy(() => import('@/pages/test/EnhancedChartDemo'));
const InstitutionalDashboard = lazy(() => import('@/pages/institutional/InstitutionalDashboard'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics'));
const AdminAffiliates = lazy(() => import('@/pages/admin/Affiliates'));
const AffiliateApplications = lazy(() => import('@/pages/admin/AffiliateApplications'));

// Lazy load heavy components
const QuantLayout = lazy(() => import('@/components/quant/layout/QuantLayout'));
const CryptoLayout = lazy(() => import('@/components/crypto/layout/CryptoLayout'));
const AdvancedRiskDashboard = lazy(() => import('@/components/institutional/AdvancedRiskDashboard').then(m => ({ default: m.AdvancedRiskDashboard })));
const PortfolioManagement = lazy(() => import('@/components/institutional/PortfolioManagement').then(m => ({ default: m.PortfolioManagement })));
const QuantitativeResearch = lazy(() => import('@/components/institutional/QuantitativeResearch').then(m => ({ default: m.QuantitativeResearch })));
const AdvancedBacktesting = lazy(() => import('@/components/institutional/AdvancedBacktesting').then(m => ({ default: m.AdvancedBacktesting })));
const PerformanceAttribution = lazy(() => import('@/components/institutional/PerformanceAttribution').then(m => ({ default: m.PerformanceAttribution })));
const RealTimeRiskMonitoring = lazy(() => import('@/components/institutional/RealTimeRiskMonitoring').then(m => ({ default: m.RealTimeRiskMonitoring })));

// Lazy load debug components
const SubscriptionDiagnostic = lazy(() => import('@/components/debug/SubscriptionDiagnostic').then(m => ({ default: m.SubscriptionDiagnostic })));
const UserIDDisplay = lazy(() => import('@/components/debug/UserIDDisplay').then(m => ({ default: m.UserIDDisplay })));
const SessionRecovery = lazy(() => import('@/components/debug/SessionRecovery').then(m => ({ default: m.SessionRecovery })));
const AuthTest = lazy(() => import('@/components/debug/AuthTest').then(m => ({ default: m.AuthTest })));
const EditorTest = lazy(() => import('@/components/editor/EditorTest').then(m => ({ default: m.EditorTest })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function App() {
  console.log('App component rendering...');
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <UserProvider>
        <SubscriptionProvider>
          <OfflineSyncProvider>
            <Router>
              {/* Global interceptor to catch recovery links anywhere */}
              <RecoveryInterceptor />
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<SignIn />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/register" element={<SignUp />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/subscription" element={<SubscriptionPage />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/affiliates" element={<Suspense fallback={<PageLoader />}><Affiliates /></Suspense>} />
                <Route path="/affiliate-signup" element={<Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense>} />
                <Route path="/affiliate-terms" element={<Suspense fallback={<PageLoader />}><AffiliateTerms /></Suspense>} />
                <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
                <Route path="/marketplace" element={<Suspense fallback={<PageLoader />}><Marketplace /></Suspense>} />
                <Route path="/marketplace/create" element={<Suspense fallback={<PageLoader />}><CreateProduct /></Suspense>} />
                <Route path="/marketplace/seller" element={<Suspense fallback={<PageLoader />}><SellerDashboard /></Suspense>} />
                <Route path="/auth/callback" element={<Suspense fallback={<PageLoader />}><AuthCallback /></Suspense>} />
                <Route path="/auth/reset" element={<PasswordResetHandler />} />
                <Route path="/debug/password-reset" element={<Suspense fallback={<PageLoader />}><PasswordResetDebug /></Suspense>} />
                <Route path="/debug/password-reset-diagnostic" element={<Suspense fallback={<PageLoader />}><PasswordResetDiagnostic /></Suspense>} />
                <Route path="/debug/url" element={<Suspense fallback={<PageLoader />}><URLDebugger /></Suspense>} />
                <Route path="/test/enhanced-chart" element={<Suspense fallback={<PageLoader />}><EnhancedChartDemo /></Suspense>} />
                <Route path="/test-app" element={
                  <SimpleAppGuard>
                    <Suspense fallback={<PageLoader />}>
                      <TestApp />
                    </Suspense>
                  </SimpleAppGuard>
                } />

                <Route path="/app" element={
                  <SimpleAppGuard>
                    <AppLayout />
                  </SimpleAppGuard>
                }>
                  <Route index element={<Analytics />} />
                  <Route path="dashboard" element={<Analytics />} />
                  <Route path="trades" element={<Trades />} />
                  <Route path="trades/add" element={<AddTrade />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
                  <Route path="pl-statements" element={<Suspense fallback={<PageLoader />}><PLStatements /></Suspense>} />
                  <Route path="performance" element={<Performance />} />
                  <Route path="journal" element={<Journal />} />
                  <Route path="journal/all-entries" element={<Suspense fallback={<PageLoader />}><AllJournalEntries /></Suspense>} />
                  <Route path="leaderboard" element={<Leaderboard />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="backtesting" element={<Backtesting />} />
                  <Route path="algo" element={<Suspense fallback={<PageLoader />}><Algo /></Suspense>} />
                  <Route path="api-keys" element={<Suspense fallback={<PageLoader />}><APIKeys /></Suspense>} />
                  {/* Quant Backtester Routes */}
                  <Route path="quant" element={
                    <FeatureAccessGuard feature="quant-testing">
                      <Suspense fallback={<PageLoader />}>
                        <QuantLayout />
                      </Suspense>
                    </FeatureAccessGuard>
                  }>
                    <Route index element={<Suspense fallback={<PageLoader />}><QuantDashboard /></Suspense>} />
                    <Route path="algorithms" element={<Suspense fallback={<PageLoader />}><QuantAlgorithms /></Suspense>} />
                    <Route path="algorithms/new" element={<Suspense fallback={<PageLoader />}><QuantAlgorithmEditor /></Suspense>} />
                    <Route path="algorithms/:id/edit" element={<Suspense fallback={<PageLoader />}><QuantAlgorithmEditor /></Suspense>} />
                    <Route path="backtests" element={<Suspense fallback={<PageLoader />}><QuantBacktestAnalysis /></Suspense>} />
                    <Route path="backtests/:id" element={<Suspense fallback={<PageLoader />}><QuantBacktestReport /></Suspense>} />
                    <Route path="optimization" element={<Suspense fallback={<PageLoader />}><QuantOptimization /></Suspense>} />
                    <Route path="deployment" element={<Suspense fallback={<PageLoader />}><QuantDeployment /></Suspense>} />
                    <Route path="chart" element={<Suspense fallback={<PageLoader />}><QuantEquityChart /></Suspense>} />
                    <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                  </Route>
                  {/* Legacy route - redirect to new quant dashboard */}
                  <Route path="quanttesting" element={
                    <FeatureAccessGuard feature="quant-testing">
                      <Navigate to="/app/quant" replace />
                    </FeatureAccessGuard>
                  } />
                  <Route path="copy-trader" element={
                    <FeatureAccessGuard feature="copy-trading">
                      <Suspense fallback={<PageLoader />}>
                        <CopyTrader />
                      </Suspense>
                    </FeatureAccessGuard>
                  } />
                  <Route path="live-trading" element={<Suspense fallback={<PageLoader />}><WagyuTechLiveTrading /></Suspense>} />
                  <Route path="fundamental-data" element={<Suspense fallback={<PageLoader />}><FundamentalData /></Suspense>} />
                  <Route path="crypto-analytics" element={
                    <FeatureAccessGuard feature="copy-trading">
                      <Suspense fallback={<PageLoader />}>
                        <CryptoAnalytics />
                      </Suspense>
                    </FeatureAccessGuard>
                  } />
                  <Route path="affiliate" element={
                    <AffiliateGuard>
                      <Suspense fallback={<PageLoader />}>
                        <AffiliateDashboard />
                      </Suspense>
                    </AffiliateGuard>
                  } />

                  {/* Institutional Routes */}
                  <Route path="institutional" element={<Suspense fallback={<PageLoader />}><InstitutionalDashboard /></Suspense>} />
                  <Route path="risk-dashboard" element={<Suspense fallback={<PageLoader />}><AdvancedRiskDashboard /></Suspense>} />
                  <Route path="portfolio-management" element={<Suspense fallback={<PageLoader />}><PortfolioManagement /></Suspense>} />
                  <Route path="quantitative-research" element={<Suspense fallback={<PageLoader />}><QuantitativeResearch /></Suspense>} />
                  <Route path="advanced-backtesting" element={<Suspense fallback={<PageLoader />}><AdvancedBacktesting /></Suspense>} />
                  <Route path="performance-attribution" element={<Suspense fallback={<PageLoader />}><PerformanceAttribution /></Suspense>} />
                  <Route path="risk-monitoring" element={<Suspense fallback={<PageLoader />}><RealTimeRiskMonitoring /></Suspense>} />

                </Route>

                {/* Crypto Dashboard Routes - Use main AppLayout */}
                <Route path="/crypto" element={
                  <SimpleAppGuard>
                    <AppLayout />
                  </SimpleAppGuard>
                }>
                  <Route index element={<Suspense fallback={<PageLoader />}><CryptoDashboard /></Suspense>} />
                  <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><CryptoDashboard /></Suspense>} />
                  <Route path="wallets" element={<Suspense fallback={<PageLoader />}><CryptoWallets /></Suspense>} />
                  <Route path="copy-trading" element={<Suspense fallback={<PageLoader />}><CopyTradingPage /></Suspense>} />
                  <Route path="on-chain" element={<Suspense fallback={<PageLoader />}><OnChainAnalysisPage /></Suspense>} />
                  <Route path="surge" element={<Suspense fallback={<PageLoader />}><AxiomSurgePage /></Suspense>} />
                  <Route path="tokens" element={<Suspense fallback={<PageLoader />}><TokensPage /></Suspense>} />
                  <Route path="explore" element={<Suspense fallback={<PageLoader />}><ExplorePage /></Suspense>} />
                  <Route path="solnavigator" element={<Suspense fallback={<PageLoader />}><SolNavigator /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                </Route>

                {/* API Routes */}
                <Route path="/api" element={
                  <SimpleAppGuard>
                    <AppLayout />
                  </SimpleAppGuard>
                }>
                  <Route path="keys" element={<Suspense fallback={<PageLoader />}><APIKeys /></Suspense>} />
                </Route>

                {/* Admin Routes */}
                <Route path="/admin" element={
                  <AuthGuard>
                    <AdminGuard>
                      <AdminLayout />
                    </AdminGuard>
                  </AuthGuard>
                }>
                  <Route index element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
                  <Route path="users" element={<Suspense fallback={<PageLoader />}><AdminUsers /></Suspense>} />
                  <Route path="affiliates" element={<Suspense fallback={<PageLoader />}><AdminAffiliates /></Suspense>} />
                  <Route path="affiliate-applications" element={<Suspense fallback={<PageLoader />}><AffiliateApplications /></Suspense>} />
                  <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AdminAnalytics /></Suspense>} />
                  <Route path="logs" element={<div>Event Logs</div>} />
                  <Route path="database" element={<div>Database Management</div>} />
                  <Route path="notifications" element={<div>Notification Center</div>} />
                  <Route path="docs" element={<div>Documentation</div>} />
                  <Route path="settings" element={<div>Admin Settings</div>} />
                </Route>

                {/* Legacy route */}
                <Route path="/admin/dashboard" element={<Suspense fallback={<PageLoader />}><DeveloperDashboard /></Suspense>} />
              </Routes>
              <OfflineIndicator />
              <Toaster />
            </Router>
          </OfflineSyncProvider>
        </SubscriptionProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
