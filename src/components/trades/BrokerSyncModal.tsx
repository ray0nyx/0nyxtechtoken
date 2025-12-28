import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/ThemeProvider';
import {
  Wifi,
  WifiOff,
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { OAuthConnectionModal } from './OAuthConnectionModal';

interface Broker {
  id: string;
  name: string;
  logo: string;
  description: string;
  status: 'available' | 'coming_soon' | 'beta';
  category: 'crypto' | 'forex' | 'stocks' | 'futures';
  features: string[];
  website: string;
}

const AVAILABLE_BROKERS: Broker[] = [
  {
    id: 'binance',
    name: 'Binance',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Binance_Logo.png',
    description: 'World\'s largest cryptocurrency exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://binance.com'
  },
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Cryptocurrency_Logo_Coinbase.png',
    description: 'US-based regulated cryptocurrency exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://pro.coinbase.com'
  },
  {
    id: 'kraken',
    name: 'Kraken',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Kraken_logo.svg',
    description: 'Established European cryptocurrency exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://kraken.com'
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    logo: 'https://assets.kucoin.com/vcms/upload/1f/4f/1f4f4f4f4f4f4f4f/logo-kucoin.png',
    description: 'Global cryptocurrency exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://kucoin.com'
  },
  {
    id: 'bybit',
    name: 'Bybit',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Bybit_logo.svg',
    description: 'Derivatives trading platform',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Futures trading', 'Real-time sync'],
    website: 'https://bybit.com'
  },
  {
    id: 'okx',
    name: 'OKX',
    logo: 'https://static.okx.com/cdn/assets/imgs/221/7A1A5A5A5A5A5A5A.png',
    description: 'Global cryptocurrency exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://okx.com'
  },
  {
    id: 'bitget',
    name: 'Bitget',
    logo: 'https://static.bitget.com/cdn/assets/imgs/221/7A1A5A5A5A5A5A5A.png',
    description: 'Social trading platform',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Copy trading', 'Real-time sync'],
    website: 'https://bitget.com'
  },
  {
    id: 'huobi',
    name: 'Huobi',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Huobi_Global_logo.png',
    description: 'Global digital asset exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://huobi.com'
  },
  {
    id: 'gateio',
    name: 'Gate.io',
    logo: 'https://static.gate.io/static/images/gateio_logo.png',
    description: 'International cryptocurrency exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://gate.io'
  },
  {
    id: 'mexc',
    name: 'MEXC',
    logo: 'https://static.mexc.com/static/images/mexc_logo.png',
    description: 'Global digital asset exchange',
    status: 'available',
    category: 'crypto',
    features: ['OAuth login', 'Real-time sync', 'Historical data'],
    website: 'https://mexc.com'
  },
  {
    id: 'tradovate',
    name: 'Tradovate',
    logo: 'https://tradovate.com/wp-content/themes/tradovate/assets/images/logo.svg',
    description: 'Futures trading platform',
    status: 'available',
    category: 'futures',
    features: ['OAuth login', 'Real-time sync', 'Futures trading'],
    website: 'https://tradovate.com'
  },
  {
    id: 'interactive_brokers',
    name: 'Interactive Brokers',
    logo: 'https://www.interactivebrokers.com/images/web/logos/ib-logo.svg',
    description: 'Global brokerage firm',
    status: 'coming_soon',
    category: 'stocks',
    features: ['Global markets', 'Advanced trading', 'Professional tools'],
    website: 'https://interactivebrokers.com'
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    logo: 'https://ninjatrader.com/wp-content/themes/ninjatrader/assets/images/logo.svg',
    description: 'Trading platform and brokerage',
    status: 'available',
    category: 'futures',
    features: ['OAuth login', 'File monitoring', 'Advanced charting'],
    website: 'https://ninjatrader.com'
  }
];

interface BrokerSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrokerSelected?: (brokerId: string) => void;
}

export function BrokerSyncModal({ isOpen, onClose, onBrokerSelected }: BrokerSyncModalProps) {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const categories = [
    { id: 'all', name: 'All Brokers', count: AVAILABLE_BROKERS.length },
    { id: 'crypto', name: 'Crypto Exchanges', count: AVAILABLE_BROKERS.filter(b => b.category === 'crypto').length },
    { id: 'futures', name: 'Futures Trading', count: AVAILABLE_BROKERS.filter(b => b.category === 'futures').length },
    { id: 'stocks', name: 'Stock Brokers', count: AVAILABLE_BROKERS.filter(b => b.category === 'stocks').length }
  ];

  const filteredBrokers = selectedCategory === 'all'
    ? AVAILABLE_BROKERS
    : AVAILABLE_BROKERS.filter(broker => broker.category === selectedCategory);

  const handleBrokerClick = (broker: Broker) => {
    if (broker.status === 'available') {
      setSelectedBroker(broker);
      setShowOAuthModal(true);
    }
  };

  const handleOAuthSuccess = (brokerId: string) => {
    setIsConnecting(false);
    setShowOAuthModal(false);
    onBrokerSelected?.(brokerId);
    onClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Wifi className="h-4 w-4 text-emerald-400" />;
      case 'coming_soon':
        return <WifiOff className="h-4 w-4 text-gray-400 dark:text-slate-500" />;
      case 'beta':
        return <AlertCircle className="h-4 w-4 text-amber-400" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400 dark:text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Available</Badge>;
      case 'coming_soon':
        return <Badge className="bg-gray-200 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-slate-600">Coming Soon</Badge>;
      case 'beta':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Beta</Badge>;
      default:
        return <Badge className="bg-gray-200 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-slate-600">Unknown</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-4xl max-h-[80vh] overflow-hidden border-white/10 bg-black"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Wifi className="w-6 h-6 text-emerald-400" />
              </div>
              Connect Your Broker
            </DialogTitle>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Choose a broker to automatically sync your trades in real-time
            </p>
          </DialogHeader>

          <div className="flex flex-col h-full">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className={
                    selectedCategory === category.id
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-slate-300 border-white/10 hover:border-white/20'
                  }
                >
                  {category.name} ({category.count})
                </Button>
              ))}
            </div>

            {/* Brokers Grid */}
            <div className="flex-1 overflow-y-auto max-h-96 relative">
              {/* Scroll indicator */}
              <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none"></div>

              {/* Scroll hint */}
              {filteredBrokers.length > 6 && (
                <div className="absolute top-2 right-2 z-20">
                  <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                    Scroll to see more
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 pt-2">
                {filteredBrokers.map((broker) => (
                  <Card
                    key={broker.id}
                    className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 bg-neutral-900 border-white/10 backdrop-blur-sm ${broker.status === 'available'
                        ? 'hover:border-emerald-500/50 hover:shadow-emerald-500/20'
                        : 'opacity-60 cursor-not-allowed'
                      }`}
                    onClick={() => handleBrokerClick(broker)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <img
                            src={broker.logo}
                            alt={broker.name}
                            className="w-10 h-10 rounded-lg object-contain bg-gray-100 dark:bg-white/5 p-1"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div>
                            <h3 className="font-semibold text-lg text-white">{broker.name}</h3>
                            <p className="text-sm text-gray-400">{broker.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {getStatusIcon(broker.status)}
                          {getStatusBadge(broker.status)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {broker.features.map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs bg-black/50 text-slate-300 border-white/10">
                              {feature}
                            </Badge>
                          ))}
                        </div>

                        {broker.status === 'available' && (
                          <div className="flex items-center justify-between pt-2">
                            <Button
                              size="sm"
                              className="flex-1 mr-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white hover:scale-105 transition-all duration-300 shadow-lg shadow-emerald-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBrokerClick(broker);
                              }}
                            >
                              {isConnecting && selectedBroker?.id === broker.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              )}
                              Connect
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-neutral-800 hover:bg-neutral-700 text-slate-300 border-white/10 hover:border-white/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(broker.website, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {broker.status === 'coming_soon' && (
                          <div className="text-center py-2">
                            <p className="text-sm text-gray-500 dark:text-slate-500">
                              Integration coming soon
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 pt-4 border-t border-white/10">
              <Button
                variant="outline"
                onClick={onClose}
                className="bg-neutral-800 hover:bg-neutral-700 text-slate-300 border-white/10 hover:border-white/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* OAuth Connection Modal */}
      {selectedBroker && (
        <OAuthConnectionModal
          isOpen={showOAuthModal}
          onClose={() => {
            setShowOAuthModal(false);
            setSelectedBroker(null);
            setIsConnecting(false);
          }}
          onConnectionSuccess={handleOAuthSuccess}
          broker={selectedBroker}
        />
      )}
    </>
  );
}
