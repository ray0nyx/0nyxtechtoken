import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration } from '@/lib/analytics';

interface TradeFillDetailsProps {
  trade: {
    buyFillId?: string | null;
    sellFillId?: string | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    boughtTimestamp?: string | null;
    soldTimestamp?: string | null;
    duration?: number | null;
  };
}

export function TradeFillDetails({ trade }: TradeFillDetailsProps) {
  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fill Details</CardTitle>
        <CardDescription>Detailed information about trade fills</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Fill ID</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Buy</TableCell>
              <TableCell>{trade.buyFillId || 'N/A'}</TableCell>
              <TableCell>{formatPrice(trade.buyPrice)}</TableCell>
              <TableCell>{formatTimestamp(trade.boughtTimestamp)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Sell</TableCell>
              <TableCell>{trade.sellFillId || 'N/A'}</TableCell>
              <TableCell>{formatPrice(trade.sellPrice)}</TableCell>
              <TableCell>{formatTimestamp(trade.soldTimestamp)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        
        <div className="mt-4 p-3 bg-muted rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Trade Duration:</span>
            <span className="text-sm font-bold">{formatDuration(trade.duration)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 