import { SolanaWalletAnalytics } from '../components/analytics/SolanaWalletAnalytics';
import React from 'react';

export default function SolanaWalletsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Solana Wallet Analytics</h1>
      {/* Solana wallet management and analytics overview */}
      <SolanaWalletAnalytics />
      {/* Visual analytics (will be added below) */}
      {/* <PortfolioPieChart /> */}
      {/* <TokenHoldingsTable /> */}
      {/* <SolBalanceLineChart /> */}
      {/* <SolanaTxHeatmap /> */}
    </div>
  );
}

