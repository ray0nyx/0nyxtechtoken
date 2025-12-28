/**
 * Trade Notification Components
 * 
 * Data-driven Framer Motion animations for:
 * - Trade execution notifications (buy/sell)
 * - Price alerts
 * - Wallet balance updates
 * - Order status changes
 * 
 * Animation Rules:
 * - Entry: 100-150ms max
 * - Exit: 100ms max
 * - No continuous animations unless reflecting data state
 * - Use layoutId for smooth list reordering
 * - No timer-based or cosmetic-only motion
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trade, PendingOrder } from '@/stores/useTradingStore';

// ============ Animation Variants ============

const notificationVariants: Variants = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: {
      duration: 0.1,
      ease: 'easeIn',
    },
  },
};

const pulseVariants: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
};

const slideInVariants: Variants = {
  initial: { x: 100, opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    x: 100,
    opacity: 0,
    transition: {
      duration: 0.1,
    },
  },
};

const tickerVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.1 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.1 },
  },
};

// ============ Trade Notification Component ============

interface TradeNotificationProps {
  trade: Trade;
  onDismiss?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function TradeNotification({
  trade,
  onDismiss,
  autoHide = true,
  autoHideDelay = 5000,
}: TradeNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHideDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, onDismiss]);
  
  const isBuy = trade.side === 'buy';
  const Icon = isBuy ? TrendingUp : TrendingDown;
  
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toFixed(2);
  };
  
  const formatPrice = (price: number) => {
    if (price < 0.00001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          layoutId={`trade-${trade.signature}`}
          variants={notificationVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border backdrop-blur-sm",
            isBuy
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-red-500/10 border-red-500/30"
          )}
        >
          <motion.div
            variants={pulseVariants}
            initial="initial"
            animate="pulse"
            className={cn(
              "p-2 rounded-full",
              isBuy ? "bg-emerald-500/20" : "bg-red-500/20"
            )}
          >
            <Icon className={cn(
              "w-4 h-4",
              isBuy ? "text-emerald-400" : "text-red-400"
            )} />
          </motion.div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-medium",
                isBuy ? "text-emerald-400" : "text-red-400"
              )}>
                {isBuy ? 'Buy' : 'Sell'}
              </span>
              <span className="text-gray-400 text-sm truncate">
                {formatAmount(trade.amountToken)} tokens
              </span>
            </div>
            <div className="text-sm text-gray-500">
              @ ${formatPrice(trade.priceUsd)}
            </div>
          </div>
          
          {onDismiss && (
            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============ Order Status Notification ============

interface OrderStatusNotificationProps {
  order: PendingOrder;
  onDismiss?: () => void;
}

export function OrderStatusNotification({
  order,
  onDismiss,
}: OrderStatusNotificationProps) {
  const getStatusConfig = () => {
    switch (order.status) {
      case 'pending':
        return {
          icon: Loader2,
          color: 'text-yellow-400',
          bg: 'bg-yellow-500/10 border-yellow-500/30',
          animate: true,
        };
      case 'submitted':
        return {
          icon: Loader2,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10 border-blue-500/30',
          animate: true,
        };
      case 'filled':
        return {
          icon: CheckCircle,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          animate: false,
        };
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-gray-400',
          bg: 'bg-gray-500/10 border-gray-500/30',
          animate: false,
        };
      case 'failed':
        return {
          icon: AlertTriangle,
          color: 'text-red-400',
          bg: 'bg-red-500/10 border-red-500/30',
          animate: false,
        };
      default:
        return {
          icon: Loader2,
          color: 'text-gray-400',
          bg: 'bg-gray-500/10 border-gray-500/30',
          animate: false,
        };
    }
  };
  
  const config = getStatusConfig();
  const Icon = config.icon;
  
  return (
    <motion.div
      layoutId={`order-${order.id}`}
      variants={slideInVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border backdrop-blur-sm",
        config.bg
      )}
    >
      <Icon className={cn(
        "w-5 h-5",
        config.color,
        config.animate && "animate-spin"
      )} />
      
      <div className="flex-1">
        <div className="font-medium text-white">
          {order.side.toUpperCase()} {order.amount} SOL
        </div>
        <div className="text-sm text-gray-400 capitalize">
          {order.status}
          {order.txSignature && (
            <span className="ml-2 text-blue-400">
              {order.txSignature.slice(0, 8)}...
            </span>
          )}
        </div>
        {order.error && (
          <div className="text-xs text-red-400 mt-1">
            {order.error}
          </div>
        )}
      </div>
      
      {onDismiss && order.status !== 'pending' && order.status !== 'submitted' && (
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

// ============ Price Ticker Component ============

interface PriceTickerProps {
  price: number;
  previousPrice?: number;
  currency?: string;
  className?: string;
}

export function PriceTicker({
  price,
  previousPrice,
  currency = '$',
  className,
}: PriceTickerProps) {
  const [displayPrice, setDisplayPrice] = useState(price);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  
  useEffect(() => {
    if (previousPrice !== undefined && price !== previousPrice) {
      setDirection(price > previousPrice ? 'up' : 'down');
      
      // Clear direction after animation
      const timer = setTimeout(() => setDirection(null), 500);
      return () => clearTimeout(timer);
    }
    setDisplayPrice(price);
  }, [price, previousPrice]);
  
  const formatPrice = (p: number) => {
    if (p >= 1000000) return `${(p / 1000000).toFixed(2)}M`;
    if (p >= 1000) return `${(p / 1000).toFixed(2)}K`;
    if (p < 0.00001) return p.toExponential(2);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toFixed(2);
  };
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-gray-400">{currency}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={displayPrice}
          variants={tickerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn(
            "font-mono font-medium transition-colors duration-200",
            direction === 'up' && "text-emerald-400",
            direction === 'down' && "text-red-400",
            !direction && "text-white"
          )}
        >
          {formatPrice(displayPrice)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ============ Balance Update Animation ============

interface BalanceUpdateProps {
  balance: number;
  previousBalance?: number;
  symbol?: string;
  decimals?: number;
}

export function BalanceUpdate({
  balance,
  previousBalance,
  symbol = 'SOL',
  decimals = 4,
}: BalanceUpdateProps) {
  const [showChange, setShowChange] = useState(false);
  const [change, setChange] = useState(0);
  
  useEffect(() => {
    if (previousBalance !== undefined && balance !== previousBalance) {
      setChange(balance - previousBalance);
      setShowChange(true);
      
      const timer = setTimeout(() => setShowChange(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [balance, previousBalance]);
  
  const isPositive = change > 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-white font-medium">
        {balance.toFixed(decimals)} {symbol}
      </span>
      
      <AnimatePresence>
        {showChange && (
          <motion.span
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "text-sm font-medium",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {isPositive ? '+' : ''}{change.toFixed(decimals)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Notification Container ============

interface NotificationContainerProps {
  children: React.ReactNode;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

export function NotificationContainer({
  children,
  position = 'top-right',
}: NotificationContainerProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
  };
  
  return (
    <div className={cn(
      "fixed z-50 flex flex-col gap-2 max-w-sm w-full",
      positionClasses[position]
    )}>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}

// ============ Trade List Animation ============

interface AnimatedTradeListProps {
  trades: Trade[];
  maxItems?: number;
  onTradeClick?: (trade: Trade) => void;
}

export function AnimatedTradeList({
  trades,
  maxItems = 10,
  onTradeClick,
}: AnimatedTradeListProps) {
  const displayTrades = trades.slice(0, maxItems);
  
  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {displayTrades.map((trade) => (
          <motion.div
            key={trade.signature}
            layoutId={trade.signature}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onTradeClick?.(trade)}
            className={cn(
              "flex items-center justify-between p-2 rounded cursor-pointer",
              "hover:bg-white/5 transition-colors",
              trade.side === 'buy'
                ? "border-l-2 border-emerald-500"
                : "border-l-2 border-red-500"
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium w-8",
                trade.side === 'buy' ? "text-emerald-400" : "text-red-400"
              )}>
                {trade.side.toUpperCase()}
              </span>
              <span className="text-sm text-gray-300">
                {trade.amountSol.toFixed(4)} SOL
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(trade.timestamp).toLocaleTimeString()}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default TradeNotification;





