import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { authService } from '@/services/authService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { getTurnkeyService } from '@/lib/wallet-abstraction/turnkey-service';

interface SolanaSignInButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onSuccess?: () => void;
  label?: string;
  isPhantom?: boolean;
}

export function SolanaSignInButton({
  variant = 'outline',
  className = '',
  onSuccess,
  label,
  isPhantom = false,
}: SolanaSignInButtonProps) {
  const { publicKey, signMessage, connected, connect, wallet, select, wallets } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const displayLabel = label || (isPhantom ? 'Sign in with Phantom' : 'Sign in with Solana');

  const handleSignIn = async () => {
    try {
      setIsLoading(true);

      // If isPhantom is true, specifically look for and select Phantom
      if (isPhantom && !connected) {
        const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
        if (phantomWallet) {
          select(phantomWallet.adapter.name);
        }
      }

      // Check if wallet is connected
      if (!connected || !publicKey) {
        // Try to connect wallet
        if (wallet && connect) {
          await connect();
          // Wait a bit for connection to establish
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          toast({
            title: 'Wallet Not Connected',
            description: isPhantom ? 'Please connect your Phantom wallet' : 'Please connect your Solana wallet first',
            variant: 'destructive',
          });
          return;
        }
      }

      if (!publicKey || !signMessage) {
        toast({
          title: 'Error',
          description: 'Wallet not ready. Please connect your wallet.',
          variant: 'destructive',
        });
        return;
      }

      // Sign in with Solana
      const result = await authService.signInWithSolana(
        publicKey,
        signMessage
      );

      toast({
        title: 'Success',
        description: result.user.isNewUser
          ? 'Account created! Welcome to 0nyx.'
          : 'Successfully signed in with Solana wallet',
      });

      if (onSuccess) {
        onSuccess();
      } else {
        // Navigate to analytics page
        navigate('/app/analytics');
      }
    } catch (error: any) {
      console.error('Solana sign-in error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in with Solana wallet',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={`w-full h-12 transition-all duration-300 font-bold ${isPhantom
        ? 'bg-[#AB9FF2] hover:bg-[#9689e3] text-white border-none shadow-[0_0_15px_rgba(171,159,242,0.3)]'
        : className
        }`}
      onClick={handleSignIn}
      disabled={isLoading || (!wallet && !isPhantom)}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          {isPhantom ? (
            <img
              src="/icons/Phantom_SVG_Icon.svg"
              alt="Phantom Logo"
              className="h-5 w-5 mr-3"
            />
          ) : (
            <svg
              className="h-5 w-5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {displayLabel}
        </>
      )}
    </Button>
  );
}
