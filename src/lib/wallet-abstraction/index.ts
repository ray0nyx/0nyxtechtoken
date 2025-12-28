/**
 * Wallet Abstraction Module
 * 
 * Exports all wallet-related functionality for easy imports
 */

// Turnkey service
export { TurnkeyService, getTurnkeyService } from './turnkey-service';
export type { TurnkeyWallet, TurnkeySubOrganization, SignatureRequest, SignatureResponse } from './turnkey-service';

// Wallet adapter
export { createTurnkeyWalletAdapter, getOrCreateTurnkeyWallet } from './turnkey-wallet';
export type { TurnkeyWalletAdapter } from './turnkey-wallet';

// Context and hooks
export { TurnkeyWalletProvider, useTurnkeyWallet } from './TurnkeyWalletContext';

// Trading utilities
export {
    executeSwap,
    getSolBalance,
    getTokenBalance,
    checkMevRisk,
    getJitoTipAccounts,
    quickBuy,
    quickSell,
} from './trading-utils';
