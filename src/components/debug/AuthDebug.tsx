import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAuthenticatedUser } from '@/lib/utils/authUtils';

export function AuthDebug() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('AuthDebug: Starting authentication check...');
        
        // Test 1: Direct getUser
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('AuthDebug: getUser result:', { user, userError });
        
        // Test 2: getSession
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('AuthDebug: getSession result:', { session, sessionError });
        
        // Test 3: Auth utility
        try {
          const authUser = await getAuthenticatedUser();
          console.log('AuthDebug: Auth utility result:', authUser);
        } catch (authError) {
          console.log('AuthDebug: Auth utility failed:', authError);
        }
        
        setAuthStatus({
          user,
          userError,
          session,
          sessionError,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('AuthDebug: Error:', error);
        setAuthStatus({ error: error.message, timestamp: new Date().toISOString() });
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  if (loading) return <div>Checking authentication...</div>;

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold">Authentication Debug</h3>
      <pre className="text-xs overflow-auto max-h-96">
        {JSON.stringify(authStatus, null, 2)}
      </pre>
    </div>
  );
}




