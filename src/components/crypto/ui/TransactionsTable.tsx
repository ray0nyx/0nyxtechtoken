import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ExternalLink, Download, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface Transaction {
  id: string;
  date: string;
  type: 'buy' | 'sell';
  usd: number;
  baseAmount: number;
  quoteAmount: number;
  price: number;
  maker: string;
  txHash: string;
  baseSymbol: string;
  quoteSymbol: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  className?: string;
  theme?: 'dark' | 'light';
}

type SortField = 'date' | 'type' | 'usd' | 'price';
type SortDirection = 'asc' | 'desc';

export default function TransactionsTable({
  transactions,
  className,
  theme = 'dark',
}: TransactionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '24h' | '7d'>('all');
  const isDark = theme === 'dark';

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else if (price >= 0.01) {
      return price.toFixed(6);
    } else if (price >= 0.0001) {
      return price.toFixed(8);
    } else if (price >= 0.000001) {
      return price.toFixed(10);
    } else {
      return price.toExponential(4);
    }
  };

  const formatTime = (time: string): string => {
    const date = new Date(time);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const formatAddress = (address: string): string => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    // Filter by time
    if (timeFilter !== 'all') {
      const now = Date.now();
      const timeThresholds: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const threshold = timeThresholds[timeFilter];
      filtered = filtered.filter(tx => {
        const txTime = new Date(tx.date).getTime();
        return now - txTime <= threshold;
      });
    }

    return filtered;
  }, [transactions, typeFilter, timeFilter]);

  const sortedTransactions = filteredTransactions.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'type':
        aValue = a.type === 'buy' ? 1 : 0;
        bValue = b.type === 'buy' ? 1 : 0;
        break;
      case 'usd':
        aValue = a.usd;
        bValue = b.usd;
        break;
      case 'price':
        aValue = a.price;
        bValue = b.price;
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getSolscanUrl = (txHash: string): string => {
    return `https://solscan.io/tx/${txHash}`;
  };

  const getSolscanAccountUrl = (address: string): string => {
    return `https://solscan.io/account/${address}`;
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'Type', 'USD Value', 'Base Amount', 'Quote Amount', 'Price', 'Maker', 'Transaction Hash'].join(','),
      ...sortedTransactions.map(tx => [
        tx.date,
        tx.type,
        tx.usd,
        tx.baseAmount,
        tx.quoteAmount,
        tx.price,
        tx.maker,
        tx.txHash,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn(
      'overflow-hidden',
      isDark
        ? 'bg-[#0a0a0a]'
        : 'bg-white border-gray-200',
      className
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between',
        isDark ? 'border-neutral-800' : 'border-gray-200'
      )}>
        <h3 className={cn(
          'text-sm font-semibold',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Transactions ({filteredTransactions.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className={cn(
        'px-4 py-2 border-b flex items-center gap-2',
        isDark ? 'border-neutral-800 bg-[#0a0a0a]' : 'border-gray-200 bg-gray-50'
      )}>
        <Filter className={cn('h-4 w-4', isDark ? 'text-[#6b7280]' : 'text-gray-500')} />
        <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="buy">Buy Only</SelectItem>
            <SelectItem value="sell">Sell Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
        {(typeFilter !== 'all' || timeFilter !== 'all') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTypeFilter('all');
              setTimeFilter('all');
            }}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="max-h-[400px] overflow-y-auto">
        {sortedTransactions.length === 0 ? (
          <div className={cn(
            'px-4 py-8 text-center text-sm',
            isDark ? 'text-[#6b7280]' : 'text-gray-500'
          )}>
            {transactions.length === 0
              ? 'No transactions available'
              : 'No transactions match the selected filters'}
          </div>
        ) : (
          <table className="w-full">
            <thead className={cn(
              'sticky top-0 z-10',
              isDark ? 'bg-[#111111]' : 'bg-white'
            )}>
              <tr className={cn(
                'text-xs border-b',
                isDark ? 'text-neutral-500 border-neutral-800' : 'text-gray-500 border-gray-200'
              )}>
                <th
                  className={cn(
                    'text-left px-4 py-2 font-medium cursor-pointer transition-colors',
                    isDark ? 'hover:text-white' : 'hover:text-gray-900'
                  )}
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    DATE
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className={cn(
                    'text-left px-4 py-2 font-medium cursor-pointer transition-colors',
                    isDark ? 'hover:text-white' : 'hover:text-gray-900'
                  )}
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-1">
                    TYPE
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className={cn(
                    'text-right px-4 py-2 font-medium cursor-pointer transition-colors',
                    isDark ? 'hover:text-white' : 'hover:text-gray-900'
                  )}
                  onClick={() => handleSort('usd')}
                >
                  <div className="flex items-center justify-end gap-1">
                    USD
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className={cn(
                  'text-right px-4 py-2 font-medium',
                  isDark ? 'text-[#6b7280]' : 'text-gray-500'
                )}>
                  {sortedTransactions[0]?.baseSymbol || 'BASE'}
                </th>
                <th className={cn(
                  'text-right px-4 py-2 font-medium',
                  isDark ? 'text-[#6b7280]' : 'text-gray-500'
                )}>
                  {sortedTransactions[0]?.quoteSymbol || 'QUOTE'}
                </th>
                <th
                  className={cn(
                    'text-right px-4 py-2 font-medium cursor-pointer transition-colors',
                    isDark ? 'hover:text-white' : 'hover:text-gray-900'
                  )}
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    PRICE
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className={cn(
                  'text-left px-4 py-2 font-medium',
                  isDark ? 'text-[#6b7280]' : 'text-gray-500'
                )}>
                  MAKER
                </th>
                <th className={cn(
                  'text-left px-4 py-2 font-medium',
                  isDark ? 'text-[#6b7280]' : 'text-gray-500'
                )}>
                  TXN
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={cn(
                    'text-xs border-b transition-colors',
                    isDark
                      ? 'border-neutral-800/50 hover:bg-neutral-800/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <td className={cn(
                    'px-4 py-2',
                    isDark ? 'text-neutral-400' : 'text-gray-600'
                  )}>
                    {formatTime(tx.date)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'font-medium',
                        tx.type === 'buy' ? 'text-[#10b981]' : 'text-[#ef4444]'
                      )}
                    >
                      {tx.type === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className={cn(
                    'px-4 py-2 text-right',
                    isDark ? 'text-[#9ca3af]' : 'text-gray-600'
                  )}>
                    ${formatPrice(tx.usd)}
                  </td>
                  <td className={cn(
                    'px-4 py-2 text-right',
                    isDark ? 'text-[#9ca3af]' : 'text-gray-600'
                  )}>
                    {formatPrice(tx.baseAmount)}
                  </td>
                  <td className={cn(
                    'px-4 py-2 text-right',
                    isDark ? 'text-[#9ca3af]' : 'text-gray-600'
                  )}>
                    {formatPrice(tx.quoteAmount)}
                  </td>
                  <td className={cn(
                    'px-4 py-2 text-right font-medium',
                    isDark ? 'text-white' : 'text-gray-900'
                  )}>
                    {formatPrice(tx.price)}
                  </td>
                  <td className={cn(
                    'px-4 py-2 font-mono text-xs',
                    isDark ? 'text-[#9ca3af]' : 'text-gray-600'
                  )}>
                    <a
                      href={getSolscanAccountUrl(tx.maker)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'hover:underline transition-colors',
                        isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-600 hover:text-blue-700'
                      )}
                    >
                      {formatAddress(tx.maker)}
                      <ExternalLink className="w-3 h-3 inline ml-1" />
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={getSolscanUrl(tx.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'transition-colors flex items-center gap-1',
                        isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-600 hover:text-blue-700'
                      )}
                    >
                      {formatAddress(tx.txHash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


