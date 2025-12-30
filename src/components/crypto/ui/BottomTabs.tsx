import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Settings, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TransactionsTable, { type Transaction } from './TransactionsTable';
import TopTradersTab from './TopTradersTab';
import HoldersTab from './HoldersTab';
import KOLsTab from './KOLsTab';
import SnipersTab from './SnipersTab';
import LiquidityProvidersTab from './LiquidityProvidersTab';
import BubbleMaps from './BubbleMaps';
import PositionsTab from './PositionsTab';
import OrdersTab, { type Order } from './OrdersTab';

type TabType = 'trades' | 'positions' | 'holders' | 'orders' | 'top-traders';

interface BottomTabsProps {
  transactions: Transaction[];
  holdersCount?: number;
  theme?: 'dark' | 'light';
  className?: string;
  pairSymbol?: string;
  tokenMint?: string;
  onRefresh?: () => void;
  orders?: Order[];
  onCancelOrder?: (orderId: string) => void;
  onEditOrder?: (orderId: string) => void;
  tokenSymbol?: string;
  tokenLogo?: string;
  currentMC?: number;
}

export default function BottomTabs({
  transactions,
  holdersCount = 0,
  theme = 'dark',
  className,
  pairSymbol,
  tokenMint,
  onRefresh,
  orders = [],
  onCancelOrder,
  onEditOrder,
  tokenSymbol,
  tokenLogo,
  currentMC,
}: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trades');
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [instantTrade, setInstantTrade] = useState(true);
  const [showTradesPanel, setShowTradesPanel] = useState(true);
  const [showUSD, setShowUSD] = useState(true);
  const isDark = theme === 'dark';

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: 'trades', label: 'Trades' },
    { id: 'positions', label: 'Positions' },
    { id: 'orders', label: 'Orders' },
    { id: 'holders', label: `Holders[${holdersCount.toLocaleString()}]` },
    { id: 'top-traders', label: 'Top Traders' },
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
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? isDark
                    ? "border-neutral-400 text-neutral-300"
                    : "border-gray-600 text-gray-600"
                  : isDark
                    ? "border-transparent text-neutral-500 hover:text-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <span>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {activeTab === 'trades' ? (
          <TransactionsTable
            key={`trades-${tokenMint}`}
            transactions={transactions}
            theme={theme}
          />
        ) : activeTab === 'positions' ? (
          <PositionsTab
            key={`positions-${tokenMint}`}
            theme={theme}
          />
        ) : activeTab === 'orders' ? (
          <OrdersTab
            orders={orders.map(o => ({
              ...o,
              tokenSymbol: tokenSymbol || pairSymbol?.split('/')[0],
              tokenLogo: tokenLogo,
              currentMC: currentMC,
              targetMC: o.price, // Order price as target
            }))}
            theme={theme}
            onCancelOrder={onCancelOrder}
            onEditOrder={onEditOrder}
          />
        ) : activeTab === 'holders' ? (
          <div className="flex flex-col lg:flex-row gap-0 h-[600px] border border-neutral-800 rounded-xl overflow-hidden">
            {/* Holders Table */}
            <div className="lg:w-2/3 border-r border-neutral-800 overflow-hidden flex flex-col">
              <HoldersTab
                key={`holders-${tokenMint}`}
                tokenMint={tokenMint}
                theme={theme}
              />
            </div>
            {/* Bubble Map */}
            <div className="lg:w-1/3 overflow-hidden">
              <BubbleMaps
                pairSymbol={pairSymbol}
                tokenMint={tokenMint}
                theme={theme}
              />
            </div>
          </div>
        ) : activeTab === 'top-traders' ? (
          <TopTradersTab
            key={`toptraders-${tokenMint}`}
            tokenMint={tokenMint}
            theme={theme}
          />
        ) : null}
      </div>
    </div>
  );
}
