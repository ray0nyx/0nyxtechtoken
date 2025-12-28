import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrokerService } from '@/lib/services/brokerService';
import { TradovateService } from '@/lib/services/TradovateService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const type = params.get('type');

      // Handle password reset callback
      if (type === 'recovery') {
        try {
          setProcessingSteps(prev => [...prev, 'Processing password reset...']);
          
          const { data, error: resetError } = await supabase.auth.exchangeCodeForSession(code!);
          
          if (resetError) {
            throw resetError;
          }
          
          if (!data.session) {
            throw new Error('Failed to create session. The reset link may have expired.');
          }
          
          setProcessingSteps(prev => [...prev, 'Password reset link validated!']);
          
          toast({
            title: 'Success',
            description: 'Password reset link validated. You can now set your new password.',
          });
          
          setTimeout(() => navigate('/reset-password'), 2000);
          return;
        } catch (err: any) {
          setError(err.message);
          setProcessingSteps(prev => [...prev, `Error: ${err.message}`]);
          
          toast({
            title: 'Error',
            description: 'Failed to process password reset: ' + err.message,
            variant: 'destructive',
          });
          
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }
      }

      // Handle direct password reset redirect (fallback)
      if (code && !type && !state) {
        try {
          setProcessingSteps(prev => [...prev, 'Processing password reset...']);
          
          const { data, error: resetError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (resetError) {
            throw resetError;
          }
          
          if (!data.session) {
            throw new Error('Failed to create session. The reset link may have expired.');
          }
          
          setProcessingSteps(prev => [...prev, 'Password reset link validated!']);
          
          toast({
            title: 'Success',
            description: 'Password reset link validated. You can now set your new password.',
          });
          
          setTimeout(() => navigate('/reset-password'), 2000);
          return;
        } catch (err: any) {
          setError(err.message);
          setProcessingSteps(prev => [...prev, `Error: ${err.message}`]);
          
          toast({
            title: 'Error',
            description: 'Failed to process password reset: ' + err.message,
            variant: 'destructive',
          });
          
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }
      }

      if (error) {
        setError(error);
        toast({
          title: 'Authentication Error',
          description: error,
          variant: 'destructive',
        });
        setTimeout(() => navigate('/index'), 3000);
        return;
      }

      if (!code || !state) {
        setError('Missing required parameters');
        toast({
          title: 'Authentication Error',
          description: 'Missing required parameters',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/index'), 3000);
        return;
      }

      try {
        // Check which broker this is for
        const broker = localStorage.getItem('selectedBroker');
        
        setProcessingSteps(prev => [...prev, `Authenticating with ${broker || 'broker'}...`]);
        
        // Handle Tradovate connection specifically
        if (broker === 'Tradovate') {
          const brokerService = BrokerService.getInstance();
          await brokerService.handleOAuthCallback(code, state);
          
          setProcessingSteps(prev => [...prev, 'Successfully connected to Tradovate']);
          
          // Sync trades for Pro members
          try {
            setProcessingSteps(prev => [...prev, 'Syncing your trades...']);
            
            const tradovateService = TradovateService.getInstance();
            await tradovateService.syncTrades();
            
            setProcessingSteps(prev => [...prev, 'Trade sync completed!']);
            
            toast({
              title: 'Success',
              description: 'Your Tradovate trades have been synced to 0nyx',
            });
          } catch (syncError: any) {
            console.error('Error syncing trades:', syncError);
            setProcessingSteps(prev => [...prev, `Sync error: ${syncError.message}`]);
            
            // Still show success for the connection
            toast({
              title: 'Connected',
              description: 'Connected to Tradovate, but could not sync trades: ' + syncError.message,
              variant: 'default',
            });
          }
          
          // Navigate to analytics to see the synced trades
          setTimeout(() => navigate('/app/analytics'), 2000);
        } else {
          // Handle other brokers with the generic service
          const brokerService = BrokerService.getInstance();
          await brokerService.handleOAuthCallback(code, state);
          
          setProcessingSteps(prev => [...prev, `Successfully connected to ${broker || 'broker'}`]);
          
          // Start syncing trades
          if (broker) {
            setProcessingSteps(prev => [...prev, 'Syncing your trades...']);
            
            await brokerService.syncTrades(broker);
            
            setProcessingSteps(prev => [...prev, 'Trade sync completed!']);
            
            toast({
              title: 'Success',
              description: `Successfully synced trades from ${broker}`,
            });
          }
          
          setTimeout(() => navigate('/app/analytics'), 2000);
        }
      } catch (err: any) {
        setError(err.message);
        setProcessingSteps(prev => [...prev, `Error: ${err.message}`]);
        
        toast({
          title: 'Error',
          description: err.message,
          variant: 'destructive',
        });
        
        setTimeout(() => navigate('/app/trades/add'), 3000);
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-background to-background/80">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border border-border shadow-lg">
        {error ? (
          <div className="text-center space-y-4">
            <div className="bg-destructive/10 p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-destructive">Authentication Error</h1>
            <p className="text-muted-foreground">{error}</p>
            <div className="text-sm text-muted-foreground pt-4 border-t border-border">
              Redirecting to dashboard...
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-magenta-500 to-blue-500">
              {processingSteps.some(step => step.includes('password reset')) ? 'Processing Password Reset' : 'Connecting to Broker'}
            </h1>
            <p className="text-muted-foreground">
              {processingSteps.some(step => step.includes('password reset')) 
                ? 'Please wait while we process your password reset...' 
                : 'Please wait while we complete the authentication...'}
            </p>
            
            {processingSteps.length > 0 && (
              <div className="mt-6 text-left space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Progress:</h3>
                <ul className="space-y-2">
                  {processingSteps.map((step, index) => (
                    <li key={index} className="text-sm flex items-center">
                      <span className="w-5 h-5 flex items-center justify-center bg-primary/10 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 