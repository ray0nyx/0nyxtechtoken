import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { extractCooldownTime } from '@/utils/authErrorHandler';

interface RateLimitedButtonProps {
  onClick: () => Promise<void>;
  loading: boolean;
  children: React.ReactNode;
  cooldownSeconds?: number;
  className?: string;
  disabled?: boolean;
}

export default function RateLimitedButton({ 
  onClick, 
  loading, 
  children, 
  cooldownSeconds = 30,
  className,
  disabled = false
}: RateLimitedButtonProps) {
  const [cooldown, setCooldown] = useState(0);
  const [isOnCooldown, setIsOnCooldown] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            setIsOnCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [cooldown]);

  const handleClick = async () => {
    if (isOnCooldown || loading) return;
    
    try {
      await onClick();
      setCooldown(cooldownSeconds);
      setIsOnCooldown(true);
    } catch (error: any) {
      // Check if it's a rate limit error and extract the cooldown time
      if (error && error.message && error.message.includes('seconds')) {
        const extractedCooldown = extractCooldownTime(error);
        if (extractedCooldown > 0) {
          setCooldown(extractedCooldown);
          setIsOnCooldown(true);
        }
      }
      // Error handling is done in the parent component
    }
  };

  const getButtonText = () => {
    if (loading) return 'Sending...';
    if (isOnCooldown) return `Wait ${cooldown}s`;
    return children;
  };

  const getButtonVariant = () => {
    if (loading) return 'default';
    if (isOnCooldown) return 'secondary';
    return 'default';
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || loading || isOnCooldown}
      className={className}
      variant={getButtonVariant() as any}
    >
      {getButtonText()}
    </Button>
  );
}
