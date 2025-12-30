import React from 'react';
import { cn } from '@/lib/utils';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Order {
    id: string;
    type: 'limit' | 'stopLoss' | 'takeProfit';
    price: number;
    side: 'buy' | 'sell';
    amount: number;
    tokenSymbol?: string;
    tokenLogo?: string;
    currentMC?: number;
    targetMC?: number;
}

interface OrdersTabProps {
    orders: Order[];
    theme?: 'dark' | 'light';
    onCancelOrder?: (orderId: string) => void;
    onEditOrder?: (orderId: string) => void;
}

export default function OrdersTab({
    orders,
    theme = 'dark',
    onCancelOrder,
    onEditOrder,
}: OrdersTabProps) {
    const isDark = theme === 'dark';

    const formatNumber = (num: number): string => {
        if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    };

    const getTypeLabel = (type: Order['type']): string => {
        switch (type) {
            case 'limit': return 'Limit';
            case 'stopLoss': return 'Stop Loss';
            case 'takeProfit': return 'Take Profit';
            default: return type;
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className={cn(
                        "text-xs font-medium uppercase tracking-wider",
                        isDark ? "text-neutral-500" : "text-gray-500"
                    )}>
                        <th className="px-4 py-3 text-left">Token</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Current MC</th>
                        <th className="px-4 py-3 text-right">Target MC</th>
                        <th className="px-4 py-3 text-center">Settings</th>
                        <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                    {orders.length === 0 ? (
                        <tr>
                            <td colSpan={7} className={cn(
                                "px-4 py-8 text-center text-sm",
                                isDark ? "text-neutral-500" : "text-gray-500"
                            )}>
                                No pending orders
                            </td>
                        </tr>
                    ) : (
                        orders.map((order) => (
                            <tr
                                key={order.id}
                                className={cn(
                                    "transition-colors",
                                    isDark ? "hover:bg-neutral-900/50" : "hover:bg-gray-50"
                                )}
                            >
                                {/* Token */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {order.tokenLogo && (
                                            <img
                                                src={order.tokenLogo}
                                                alt={order.tokenSymbol}
                                                className="w-6 h-6 rounded-full"
                                            />
                                        )}
                                        <span className={cn(
                                            "text-sm font-medium",
                                            isDark ? "text-neutral-200" : "text-gray-900"
                                        )}>
                                            {order.tokenSymbol || 'TOKEN'}
                                        </span>
                                    </div>
                                </td>

                                {/* Type */}
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "text-sm px-2 py-1 rounded",
                                        order.side === 'buy'
                                            ? isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                                            : isDark ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700"
                                    )}>
                                        {order.side === 'buy' ? 'Buy' : 'Sell'} {getTypeLabel(order.type)}
                                    </span>
                                </td>

                                {/* Amount */}
                                <td className={cn(
                                    "px-4 py-3 text-right text-sm",
                                    isDark ? "text-neutral-300" : "text-gray-700"
                                )}>
                                    {order.amount.toFixed(4)} SOL
                                </td>

                                {/* Current MC */}
                                <td className={cn(
                                    "px-4 py-3 text-right text-sm",
                                    isDark ? "text-neutral-400" : "text-gray-600"
                                )}>
                                    {order.currentMC ? formatNumber(order.currentMC) : '--'}
                                </td>

                                {/* Target MC */}
                                <td className={cn(
                                    "px-4 py-3 text-right text-sm font-medium",
                                    isDark ? "text-neutral-200" : "text-gray-900"
                                )}>
                                    {order.targetMC ? formatNumber(order.targetMC) : formatNumber(order.price)}
                                </td>

                                {/* Settings */}
                                <td className="px-4 py-3 text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEditOrder?.(order.id)}
                                        className={cn(
                                            "p-1 h-auto",
                                            isDark ? "hover:bg-neutral-800" : "hover:bg-gray-200"
                                        )}
                                    >
                                        <Settings className="w-4 h-4 text-neutral-500" />
                                    </Button>
                                </td>

                                {/* Action */}
                                <td className="px-4 py-3 text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onCancelOrder?.(order.id)}
                                        className={cn(
                                            "p-1 h-auto text-red-400 hover:text-red-300",
                                            isDark ? "hover:bg-red-900/20" : "hover:bg-red-50"
                                        )}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

