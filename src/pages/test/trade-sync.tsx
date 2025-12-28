import React from 'react';
import { TradeSyncTest } from '@/components/trades/TradeSyncTest';

export default function TradeSyncTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Trade Sync Feature Test</h1>
          <p className="text-muted-foreground">
            Test the trade sync feature and subscription gating for the $39.99 Pro plan.
          </p>
        </div>
        
        <TradeSyncTest />
      </div>
    </div>
  );
}
