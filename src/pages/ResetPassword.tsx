import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProcessingToken, setIsProcessingToken] = useState(false);

  // Debug logging
  console.log('🔍 ResetPassword component loaded');
  console.log('Current URL:', window.location.href);
  console.log('Search params:', searchParams.toString());

  // Process password reset token on component mount
  useEffect(() => {
    const processPasswordReset = async () => {
      try {
        setIsProcessingToken(true);
        
        // Check for token in URL parameters
        const token = searchParams.get('token');
        const code = searchParams.get('code');
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        
        console.log('🔍 ResetPassword - Token processing:', { token, code, type, error });
        
        if (error) {
          throw new Error(`URL error parameter: ${error}`);
        }
        
        // Use token if available, otherwise fall back to code
        const resetToken = token || code;
        if (!resetToken) {
          // No token in URL, check if user already has a session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            console.warn('No token and no session found');
            toast({
              title: "No Reset Token",
              description: "Please request a new password reset link.",
              variant: "destructive",
            });
            navigate('/signin');
            return;
          }
          
          console.log('✅ Using existing session for password reset');
          return;
        }

        // Check if this is a password reset (recovery type or no type)
        const isPasswordReset = type === 'recovery' || !type;
        console.log('Is password reset:', isPasswordReset);
        
        if (!isPasswordReset) {
          console.log('Not a password reset token');
          toast({
            title: "Invalid Link",
            description: "This is not a password reset link.",
            variant: "destructive",
          });
          navigate('/signin');
          return;
        }

        console.log('🔄 Processing password reset with token:', resetToken);
        
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
        
      } catch (err: any) {
        console.error('❌ Password reset error:', err);
        
        toast({
          title: 'Error',
          description: 'Failed to process password reset: ' + err.message,
          variant: 'destructive',
        });
        
        // Redirect to signin after error
        setTimeout(() => navigate('/signin'), 3000);
      } finally {
        setIsProcessingToken(false);
      }
    };
    
    processPasswordReset();
  }, [searchParams, navigate, toast]);

  const validatePassword = (password: string): boolean => {
    if (!PASSWORD_REGEX.test(password)) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters long and contain at least one number and one special character",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (!validatePassword(password)) {
        setIsLoading(false);
        return;
      }

      // Check if user is authenticated (has a valid session)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No valid session found. Please request a new password reset link.');
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        if (error.message.includes('same as the old password')) {
          throw new Error('New password must be different from your current password');
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Your password has been reset successfully. Please log in with your new password.",
      });

      // Sign out the user and redirect to login
      await supabase.auth.signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Reset password error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while processing token
  if (isProcessingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-2xl">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
          <CardHeader className="text-center pb-6">
            <div 
              className="font-extrabold text-2xl mb-4 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
              onClick={() => navigate('/')}
            >
              <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
              <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
            </div>
            <CardTitle className="text-gray-900 text-xl font-bold">Reset Password</CardTitle>
            <CardDescription className="text-gray-600 text-sm">
              Enter your new password. It must be at least 8 characters long and contain at least one number and one special character.
            </CardDescription>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <Input 
                  id="password" 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  disabled={isLoading}
                  required 
                  className="pl-10 h-12 rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-black placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <Input 
                  id="confirm-password" 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  disabled={isLoading}
                  required 
                  className="pl-10 h-12 rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-black placeholder:text-gray-500"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
} 