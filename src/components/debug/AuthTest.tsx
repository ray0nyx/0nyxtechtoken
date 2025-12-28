import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthTest() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      setAuthStatus({
        session: session ? {
          access_token: session.access_token ? 'Present' : 'Missing',
          refresh_token: session.refresh_token ? 'Present' : 'Missing',
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          user_id: session.user?.id
        } : null,
        user: user ? {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at
        } : null,
        sessionError: error,
        userError: userError
      });
    } catch (err) {
      setAuthStatus({ error: err });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      setAuthStatus(prev => ({
        ...prev,
        refreshResult: { data, error }
      }));
    } catch (err) {
      setAuthStatus(prev => ({
        ...prev,
        refreshError: err
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Authentication Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={checkAuth} disabled={isLoading}>
            Check Auth
          </Button>
          <Button onClick={refreshSession} disabled={isLoading}>
            Refresh Session
          </Button>
        </div>
        
        {authStatus && (
          <div className="space-y-2">
            <h3 className="font-semibold">Auth Status:</h3>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(authStatus, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
