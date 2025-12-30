import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ExternalLink, Download, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface Transaction {
  id: string;
  date: string;
  type: 'buy' | 'sell';
  usd: number;
  baseAmount: number;
  baseSymbol: string;
  price: number;
  maker: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  theme?: 'dark' | 'light';
  className?: string;
}

export default function TransactionsTable({
  transactions,
  theme = 'dark',
  className
}: TransactionsTableProps) {
  const isDark = theme === 'dark';
  const [sortField, setSortField] = useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [addressFilter, setAddressFilter] = useState<string | null>(null);

  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!addressFilter) return transactions;
    return transactions.filter(tx => tx.maker === addressFilter);
  }, [transactions, addressFilter]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [filteredTransactions, sortField, sortDirection]);

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(8);
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getSolscanAccountUrl = (address: string) => {
    return `https://solscan.io/account/${address}`;
  };

  return (
    <div className={cn('w-full flex flex-col', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {addressFilter && (
            <div className={cn(
              "px-2 py-1 rounded text-[10px] flex items-center gap-2",
              isDark ? "bg-neutral-800 text-neutral-300" : "bg-gray-100 text-gray-700"
            )}>
              <span>Filter: {formatAddress(addressFilter)}</span>
              <button onClick={() => setAddressFilter(null)} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        {sortedTransactions.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-neutral-500 text-sm italic">
            No transactions found
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                'text-[10px] uppercase font-semibold tracking-wider border-b',
                isDark ? 'border-neutral-800 text-neutral-500' : 'border-gray-100 text-gray-400'
              )}>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1 text-[10px]">TIME <ChevronDown className={cn("w-3 h-3 transition-transform", sortField === 'date' && sortDirection === 'asc' ? "rotate-180" : "")} /></div>
                </th>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('type')}>
                  <div className="flex items-center gap-1 text-[10px]">TYPE <ChevronDown className={cn("w-3 h-3 transition-transform", sortField === 'type' && sortDirection === 'asc' ? "rotate-180" : "")} /></div>
                </th>
                <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('usd')}>
                  <div className="flex items-center justify-end gap-1 text-[100x]">USD <ChevronDown className={cn("w-3 h-3 transition-transform", sortField === 'usd' && sortDirection === 'asc' ? "rotate-180" : "")} /></div>
                </th>
                <th className="text-right px-4 py-3 font-medium">AMOUNT</th>
                <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end gap-1 text-[10px]">PRICE <ChevronDown className={cn("w-3 h-3 transition-transform", sortField === 'price' && sortDirection === 'asc' ? "rotate-180" : "")} /></div>
                </th>
                <th className="text-left px-4 py-3 font-medium">TRADER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/50">
              {sortedTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={cn(
                    'transition-colors text-[11px]',
                    isDark ? 'hover:bg-neutral-900/40 border-neutral-900/50' : 'hover:bg-gray-50 border-gray-100'
                  )}
                >
                  <td className="px-4 py-3 text-neutral-400">{formatTime(tx.date)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('font-bold', tx.type === 'buy' ? 'text-emerald-500' : 'text-red-500')}>
                      {tx.type === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-300 font-mono">${tx.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-neutral-400 font-mono">
                    {tx.baseAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.baseSymbol}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-300 font-mono font-bold">${formatPrice(tx.price)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAddressFilter(addressFilter === tx.maker ? null : tx.maker)}
                        className={cn(
                          "transition-colors",
                          addressFilter === tx.maker ? "text-cyan-400" : "text-neutral-600 hover:text-neutral-400"
                        )}
                      >
                        <Search className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => window.open(getSolscanAccountUrl(tx.maker), '_blank')}
                        className="text-neutral-600 hover:text-neutral-400"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <span className="text-neutral-400 font-mono ml-1 font-bold">{formatAddress(tx.maker)}</span>
                    </div>
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
