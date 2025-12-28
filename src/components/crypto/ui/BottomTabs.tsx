import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Settings, List, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TransactionsTable, { type Transaction } from './TransactionsTable';
import TopTradersTab from './TopTradersTab';
import HoldersTab from './HoldersTab';
import KOLsTab from './KOLsTab';
import SnipersTab from './SnipersTab';
import LiquidityProvidersTab from './LiquidityProvidersTab';
import BubbleMaps from './BubbleMaps';

type TabType = 'trades' | 'positions' | 'orders' | 'holders' | 'top-traders' | 'dev-tokens';
type SubTabType = 'insightx' | 'faster100x' | 'bubblemaps' | 'cabalspy';

interface BottomTabsProps {
  transactions: Transaction[];
  holdersCount?: number;
  devTokensCount?: number;
  theme?: 'dark' | 'light';
  className?: string;
  pairSymbol?: string;
  tokenMint?: string;
  onRefresh?: () => void;
}

export default function BottomTabs({
  transactions,
  holdersCount = 0,
  devTokensCount = 0,
  theme = 'dark',
  className,
  pairSymbol,
  tokenMint,
  onRefresh,
}: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trades');
  const [activeSubTab, setActiveSubTab] = useState<SubTabType | null>(null);
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [instantTrade, setInstantTrade] = useState(true);
  const [showTradesPanel, setShowTradesPanel] = useState(true);
  const [showUSD, setShowUSD] = useState(true);
  const isDark = theme === 'dark';

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: 'trades', label: 'Trades' },
    { id: 'positions', label: 'Positions' },
    { id: 'orders', label: 'Orders' },
    { id: 'holders', label: 'Holders', count: holdersCount },
    { id: 'top-traders', label: 'Top Traders' },
    { id: 'dev-tokens', label: 'Dev Tokens', count: devTokensCount },
  ];

  const subTabs: Array<{ id: SubTabType; label: string }> = [
    { id: 'insightx', label: 'InsightX' },
    { id: 'faster100x', label: 'Faster100x' },
    { id: 'bubblemaps', label: 'Bubblemaps.io' },
    { id: 'cabalspy', label: 'CabalSpy' },
  ];

  return (
    <div className={cn(
      "w-full",
      isDark ? "bg-[#0a0a0a]" : "bg-white border-gray-200",
      className
    )}>
      {/* Main Tab Row */}
      <div className={cn(
        "flex items-center gap-1 px-4 border-b overflow-x-auto",
        isDark ? "border-neutral-800" : "border-gray-200"
      )}>
        {/* Primary Tabs */}
        <div className="flex items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveSubTab(null);
              }}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                activeTab === tab.id && !activeSubTab
                  ? isDark
                    ? "border-emerald-400 text-emerald-400"
                    : "border-blue-600 text-blue-600"
                  : isDark
                    ? "border-transparent text-neutral-500 hover:text-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded text-xs",
                  activeTab === tab.id && !activeSubTab
                    ? "bg-emerald-400/20 text-emerald-400"
                    : isDark
                      ? "bg-neutral-800 text-neutral-400"
                      : "bg-gray-200 text-gray-600"
                )}>
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className={cn("w-px h-5 mx-2", isDark ? "bg-neutral-800" : "bg-gray-200")} />

        {/* Sub Tabs (InsightX, etc.) */}
        <div className="flex items-center">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(activeSubTab === tab.id ? null : tab.id)}
              className={cn(
                "px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                activeSubTab === tab.id
                  ? isDark
                    ? "border-emerald-400 text-emerald-400"
                    : "border-blue-600 text-blue-600"
                  : isDark
                    ? "border-transparent text-neutral-500 hover:text-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 py-1">
          {/* Only Tracked Toggle */}
          <button
            onClick={() => setOnlyTracked(!onlyTracked)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              onlyTracked
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : isDark
                  ? "text-neutral-400 border border-neutral-800 hover:text-white"
                  : "text-gray-600 border border-gray-200 hover:text-gray-900"
            )}
          >
            Only Tracked
          </button>

          {/* Instant Trade Toggle */}
          <button
            onClick={() => setInstantTrade(!instantTrade)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              instantTrade
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : isDark
                  ? "text-neutral-400 border border-neutral-800 hover:text-white"
                  : "text-gray-600 border border-gray-200 hover:text-gray-900"
            )}
          >
            ⚡ Instant Trade
          </button>

          {/* Trades Panel Toggle */}
          <button
            onClick={() => setShowTradesPanel(!showTradesPanel)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              showTradesPanel
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : isDark
                  ? "text-neutral-400 border border-neutral-800 hover:text-white"
                  : "text-gray-600 border border-gray-200 hover:text-gray-900"
            )}
          >
            Trades Panel
          </button>

          {/* USD Toggle */}
          <button
            onClick={() => setShowUSD(!showUSD)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded transition-colors",
              isDark
                ? "text-neutral-400 border border-neutral-800 hover:text-white"
                : "text-gray-600 border border-gray-200 hover:text-gray-900"
            )}
          >
            ↑↓ {showUSD ? 'USD' : 'SOL'}
          </button>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className={cn(
              "p-2",
              isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>

          {/* Time Display */}
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded",
            isDark ? "bg-neutral-800 text-gray-300" : "bg-gray-100 text-gray-700"
          )}>
            <Clock className="w-3 h-3" />
            <span className="text-xs">24h</span>
          </div>

          {/* Proxies Toggle */}
          <button
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              "bg-orange-500/20 text-orange-400 border border-orange-500/30"
            )}
          >
            <Settings className="w-3 h-3" />
            Proxies
          </button>

          {/* List View Toggle */}
          <button
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            )}
          >
            <List className="w-3 h-3" />
            List
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {activeSubTab === 'bubblemaps' ? (
          <BubbleMaps
            key={`bubblemaps-${tokenMint}`}
            pairSymbol={pairSymbol}
            tokenMint={tokenMint}
            theme={theme}
          />
        ) : activeSubTab === 'insightx' ? (
          <div className={cn(
            "text-center py-8",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            InsightX analytics coming soon...
          </div>
        ) : activeSubTab === 'faster100x' ? (
          <div className={cn(
            "text-center py-8",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Faster100x scanner coming soon...
          </div>
        ) : activeSubTab === 'cabalspy' ? (
          <div className={cn(
            "text-center py-8",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            CabalSpy intelligence coming soon...
          </div>
        ) : activeTab === 'trades' ? (
          <TransactionsTable
            key={`trades-${tokenMint}`}
            transactions={transactions}
            theme={theme}
          />
        ) : activeTab === 'positions' ? (
          <div className={cn(
            "text-center py-8",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            No open positions
          </div>
        ) : activeTab === 'orders' ? (
          <div className={cn(
            "text-center py-8",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            No pending orders
          </div>
        ) : activeTab === 'holders' ? (
          <HoldersTab
            key={`holders-${tokenMint}`}
            tokenMint={tokenMint}
            theme={theme}
          />
        ) : activeTab === 'top-traders' ? (
          <TopTradersTab
            key={`toptraders-${tokenMint}`}
            tokenMint={tokenMint}
            theme={theme}
          />
        ) : activeTab === 'dev-tokens' ? (
          <div className={cn(
            "text-center py-8",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            {devTokensCount > 0
              ? `${devTokensCount} dev token(s) detected`
              : 'No dev tokens detected'
            }
          </div>
        ) : null}
      </div>
    </div>
  );
}
