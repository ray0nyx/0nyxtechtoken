import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Star, StarOff, Loader2 } from 'lucide-react';
import { watchlistService, TokenInfo } from '@/services/watchlistService';
import { useToast } from '@/components/ui/use-toast';

interface WatchlistButtonProps {
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WatchlistButton({
  tokenMint,
  tokenSymbol,
  tokenName,
  variant = 'outline',
  size = 'md',
  className = '',
}: WatchlistButtonProps) {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkWatchlistStatus();
  }, [tokenMint]);

  const checkWatchlistStatus = async () => {
    try {
      setIsLoading(true);
      const inWatchlist = await watchlistService.isInWatchlist(tokenMint);
      setIsInWatchlist(inWatchlist);
    } catch (error) {
      console.error('Error checking watchlist status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    try {
      setIsToggling(true);

      if (isInWatchlist) {
        await watchlistService.removeFromWatchlist(tokenMint);
        setIsInWatchlist(false);
        toast({
          title: 'Removed from watchlist',
          description: `${tokenSymbol || tokenMint} has been removed from your watchlist`,
        });
      } else {
        const tokenInfo: TokenInfo = {
          mint: tokenMint,
          symbol: tokenSymbol,
          name: tokenName,
        };
        await watchlistService.addToWatchlist(tokenInfo);
        setIsInWatchlist(true);
        toast({
          title: 'Added to watchlist',
          description: `${tokenSymbol || tokenMint} has been added to your watchlist`,
        });
      }
    } catch (error: any) {
      console.error('Error toggling watchlist:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update watchlist',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isToggling}
      className={className}
      title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isInWatchlist ? (
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ) : (
        <StarOff className="h-4 w-4" />
      )}
    </Button>
  );
}
