import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function PasswordResetHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlePasswordReset = async () => {
      try {
        setLoading(true);
        
        // Debug: Log all URL parameters
        console.log('🔍 PasswordResetHandler Debug Info:');
        console.log('Current URL:', window.location.href);
        console.log('Search params:', searchParams.toString());
        console.log('All params:', Object.fromEntries(searchParams.entries()));
        
        const code = searchParams.get('code');
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        
        console.log('Code:', code);
        console.log('Token:', token);
        console.log('Type:', type);
        console.log('Error:', error);
        
        if (error) {
          throw new Error(`URL error parameter: ${error}`);
        }
        
        // Use token if available, otherwise fall back to code
        const resetToken = token || code;
        if (!resetToken) {
          throw new Error('No reset token found in URL (looking for "token" or "code" parameter)');
        }

        // Check if this is a password reset (recovery type or no type)
        const isPasswordReset = type === 'recovery' || !type;
        console.log('Is password reset:', isPasswordReset);
        
        if (!isPasswordReset) {
          console.log('Not a password reset, redirecting to auth callback');
          // This is not a password reset, redirect to normal auth callback
          navigate(`/auth/callback?${searchParams.toString()}`);
          return;
        }

        console.log('🔄 Processing password reset with token:', resetToken);
        
        // Check current session before exchange
        const { data: currentSession } = await supabase.auth.getSession();
        console.log('Current session before exchange:', currentSession.session ? 'exists' : 'none');
        
        // Exchange the token for a session
        console.log('🔄 Exchanging token for session...');
        const { data, error: resetError } = await supabase.auth.exchangeCodeForSession(resetToken);
        
        console.log('Exchange result:', { data, error: resetError });
        
        if (resetError) {
          console.error('Exchange error:', resetError);
          throw resetError;
        }
        
        if (!data.session) {
          console.error('No session after exchange');
          throw new Error('Failed to create session. The reset link may have expired.');
        }
        
        console.log('✅ Password reset session created successfully');
        console.log('Session user:', data.session.user?.email);
        
        toast({
          title: 'Success',
          description: 'Password reset link validated. You can now set your new password.',
        });
        
        console.log('🔄 Redirecting to reset password page...');
        console.log('Current location before redirect:', window.location.href);
        
        // Redirect to reset password page
        navigate('/reset-password');
        
        console.log('✅ Navigation to /reset-password initiated');
        
      } catch (err: any) {
        console.error('❌ Password reset error:', err);
        setError(err.message);
        
        toast({
          title: 'Error',
          description: 'Failed to process password reset: ' + err.message,
          variant: 'destructive',
        });
        
        // Redirect to signin after error
        setTimeout(() => navigate('/signin'), 3000);
      } finally {
        setLoading(false);
      }
    };

    handlePasswordReset();
  }, [searchParams, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-2xl">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                Processing Password Reset
              </h1>
              <p className="text-gray-600">
                Please wait while we validate your password reset link...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-2xl">
            <div className="text-center space-y-4">
              <div className="bg-red-100 p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-red-600">Password Reset Error</h1>
              <p className="text-gray-600">{error}</p>
              <div className="text-sm text-gray-500 pt-4 border-t border-gray-200">
                Redirecting to sign in...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
