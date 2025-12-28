import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function SessionRecovery() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const clearSession = async () => {
    setLoading(true);
    setMessage('Clearing session...');
    
    try {
      await supabase.auth.signOut();
      setMessage('Session cleared successfully. Redirecting to signin...');
      setTimeout(() => {
        navigate('/signin');
      }, 2000);
    } catch (error) {
      console.error('Error clearing session:', error);
      setMessage('Error clearing session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    setLoading(true);
    setMessage('Checking session...');
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        setMessage(`Session error: ${error.message}`);
      } else if (session) {
        setMessage(`Session found: ${session.user?.email}`);
      } else {
        setMessage('No session found');
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Session Recovery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          If you're getting 403 errors or authentication issues, try clearing your session.
        </p>
        
        <div className="space-y-2">
          <Button 
            onClick={checkSession} 
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            Check Current Session
          </Button>
          
          <Button 
            onClick={clearSession} 
            disabled={loading}
            className="w-full"
          >
            Clear Session & Sign Out
          </Button>
        </div>
        
        {message && (
          <div className="p-3 bg-gray-100 rounded text-sm">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
