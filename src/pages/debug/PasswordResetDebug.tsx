import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function PasswordResetDebug() {
  const [searchParams] = useSearchParams();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        setSessionInfo({ data, error });
      } catch (err) {
        setSessionInfo({ error: err });
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const allParams = Object.fromEntries(searchParams.entries());
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const error = searchParams.get('error');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Password Reset Debug</h1>
      
      <div className="space-y-6">
        {/* URL Information */}
        <Card>
          <CardHeader>
            <CardTitle>URL Information</CardTitle>
            <CardDescription>Current URL and parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>Current URL:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {window.location.href}
              </code>
            </div>
            
            <div>
              <strong>Search Params String:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                {searchParams.toString()}
              </code>
            </div>
            
            <div>
              <strong>All Parameters:</strong>
              <pre className="mt-1 p-2 bg-gray-100 rounded text-sm overflow-auto">
                {JSON.stringify(allParams, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Parameter Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Parameter Analysis</CardTitle>
            <CardDescription>Analysis of URL parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>Code:</strong>
                <div className="mt-1">
                  {code ? (
                    <Badge variant="default" className="break-all">
                      {code}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Missing</Badge>
                  )}
                </div>
              </div>
              
              <div>
                <strong>Type:</strong>
                <div className="mt-1">
                  {type ? (
                    <Badge variant="default">{type}</Badge>
                  ) : (
                    <Badge variant="secondary">None</Badge>
                  )}
                </div>
              </div>
              
              <div>
                <strong>Error:</strong>
                <div className="mt-1">
                  {error ? (
                    <Badge variant="destructive">{error}</Badge>
                  ) : (
                    <Badge variant="secondary">None</Badge>
                  )}
                </div>
              </div>
              
              <div>
                <strong>Is Password Reset:</strong>
                <div className="mt-1">
                  <Badge variant={type === 'recovery' || !type ? 'default' : 'destructive'}>
                    {type === 'recovery' || !type ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Information */}
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
            <CardDescription>Current Supabase session status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading session info...</div>
            ) : (
              <pre className="p-2 bg-gray-100 rounded text-sm overflow-auto">
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Actions</CardTitle>
            <CardDescription>Test different scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => window.location.href = '/auth/reset?code=test123&type=recovery'}
                variant="outline"
              >
                Test Recovery Type
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/auth/reset?code=test123'}
                variant="outline"
              >
                Test No Type
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/auth/callback?code=test123&type=recovery'}
                variant="outline"
              >
                Test Auth Callback
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/reset-password'}
                variant="outline"
              >
                Go to Reset Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Instructions</CardTitle>
            <CardDescription>How to use this debug page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Go to Settings and request a password reset</li>
              <li>Check your email for the reset link</li>
              <li>Copy the reset link and replace the domain with localhost</li>
              <li>Visit the modified link to see what parameters are present</li>
              <li>Check the browser console for debug logs</li>
              <li>Use the test buttons to try different scenarios</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
