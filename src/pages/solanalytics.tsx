import { SolanaWalletAnalytics } from '../components/analytics/SolanaWalletAnalytics';
import React from 'react';

export default function SolanaAnalyticsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Solana Analytics</h1>
      <SolanaWalletAnalytics />
      {/* Future: Add pie chart, holdings, line chart, heatmap here */}
    </div>
  );
}

