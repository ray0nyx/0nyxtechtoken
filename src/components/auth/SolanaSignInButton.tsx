import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { authService } from '@/services/authService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SolanaSignInButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onSuccess?: () => void;
  label?: string;
}

export function SolanaSignInButton({
  variant = 'outline',
  className = '',
  onSuccess,
  label = 'Sign in with Solana',
}: SolanaSignInButtonProps) {
  const { publicKey, signMessage, connected, connect, wallet } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);

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
            description: 'Please connect your Solana wallet first',
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
      className={`w-full h-12 ${className}`}
      onClick={handleSignIn}
      disabled={isLoading || !wallet}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
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
          {label}
        </>
      )}
    </Button>
  );
}
