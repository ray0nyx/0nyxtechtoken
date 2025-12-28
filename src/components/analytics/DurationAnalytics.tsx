import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TradeAnalytics, calculateDurationMetrics, formatDuration } from '@/lib/analytics';

interface DurationAnalyticsProps {
  trades: TradeAnalytics[];
}

export function DurationAnalytics({ trades }: DurationAnalyticsProps) {
  const { averageDuration, shortestTrade, longestTrade, durationDistribution } = calculateDurationMetrics(trades);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Trade Duration Analytics</CardTitle>
        <CardDescription>Analysis of your trade durations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Average Duration</h3>
            <p className="text-2xl font-bold">{formatDuration(averageDuration)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Shortest Trade</h3>
            <p className="text-2xl font-bold">{formatDuration(shortestTrade)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Longest Trade</h3>
            <p className="text-2xl font-bold">{formatDuration(longestTrade)}</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={durationDistribution}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" name="Number of Trades" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 