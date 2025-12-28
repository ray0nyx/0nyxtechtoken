import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletContextProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  // Use mainnet-beta for production, devnet for testing
  const network = (import.meta.env.VITE_SOLANA_NETWORK as WalletAdapterNetwork) || WalletAdapterNetwork.Mainnet;

  // Use custom RPC endpoint if provided and valid, otherwise use default
  const endpoint = useMemo(() => {
    const customRpc = import.meta.env.VITE_SOLANA_RPC_URL;
    // Also check for Helius RPC as fallback
    const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;

    // Validate that the custom RPC starts with http:// or https://
    if (customRpc && (customRpc.startsWith('http://') || customRpc.startsWith('https://'))) {
      return customRpc;
    }

    // Use Helius RPC if available
    if (heliusApiKey) {
      return `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    }

    // Fall back to public cluster URL
    return clusterApiUrl(network);
  }, [network]);

  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

