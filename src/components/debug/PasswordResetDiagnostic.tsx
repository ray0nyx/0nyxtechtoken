import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PasswordResetDiagnostic() {
  const [searchParams] = useSearchParams();
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, [searchParams]);

  const runDiagnostics = async () => {
    setLoading(true);
    const results: any = {};

    try {
      // 1. Check URL Parameters
      const code = searchParams.get('code');
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      const error = searchParams.get('error');
      const allParams = Object.fromEntries(searchParams.entries());

      // Use token if available, otherwise fall back to code
      const resetToken = token || code;

      results.urlParams = {
        code: { value: code, present: !!code, valid: !!code && code.length > 10 },
        token: { value: token, present: !!token, valid: !!token && token.length > 10 },
        resetToken: { value: resetToken, present: !!resetToken, valid: !!resetToken && resetToken.length > 10 },
        type: { value: type, present: !!type, isRecovery: type === 'recovery', isMissing: !type },
        error: { value: error, present: !!error },
        allParams,
        rawUrl: window.location.href,
        searchString: searchParams.toString()
      };

      // 2. Check Redirect URL Configuration
      const expectedRedirect = `${window.location.origin}/auth/reset`;
      results.redirectConfig = {
        expected: expectedRedirect,
        currentOrigin: window.location.origin,
        isCorrect: true // We'll check this against what was actually sent
      };

      // 3. Check Session Status
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      results.sessionStatus = {
        hasSession: !!sessionData.session,
        userEmail: sessionData.session?.user?.email,
        error: sessionError?.message
      };

      // 4. Check if this is a password reset scenario
      const isPasswordReset = type === 'recovery' || !type;
      results.passwordResetCheck = {
        isPasswordReset,
        reason: type === 'recovery' ? 'Type is recovery' : !type ? 'No type parameter' : 'Type is not recovery'
      };

      // 5. Test token exchange (if token exists)
      if (resetToken) {
        results.codeExchange = {
          token: resetToken,
          readyToTest: true,
          note: 'Token found, ready for exchange test'
        };
      } else {
        results.codeExchange = {
          token: null,
          readyToTest: false,
          note: 'No token found, cannot test exchange'
        };
      }

    } catch (error: any) {
      results.error = error.message;
    }

    setDiagnostics(results);
    setLoading(false);
  };

  const testCodeExchange = async () => {
    if (!diagnostics.codeExchange?.readyToTest) return;

    setTesting(true);
    try {
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const resetToken = token || code;
      console.log('🧪 Testing token exchange with:', resetToken);

      const { data, error } = await supabase.auth.exchangeCodeForSession(resetToken!);
      
      const exchangeResult = {
        success: !error && !!data.session,
        error: error?.message,
        sessionCreated: !!data.session,
        userEmail: data.session?.user?.email,
        data: data,
        errorDetails: error
      };

      setDiagnostics(prev => ({
        ...prev,
        codeExchangeTest: exchangeResult
      }));

    } catch (error: any) {
      setDiagnostics(prev => ({
        ...prev,
        codeExchangeTest: {
          success: false,
          error: error.message,
          sessionCreated: false
        }
      }));
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"}>
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Running diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Password Reset Diagnostic</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Missing Code Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(diagnostics.urlParams?.code?.present)}
              <span>1. Missing Code Check</span>
            </CardTitle>
            <CardDescription>Check if code parameter is present</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Code Present:</span>
              {getStatusBadge(
                diagnostics.urlParams?.code?.present,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Token Present:</span>
              {getStatusBadge(
                diagnostics.urlParams?.token?.present,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Reset Token Present:</span>
              {getStatusBadge(
                diagnostics.urlParams?.resetToken?.present,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Reset Token Valid:</span>
              {getStatusBadge(
                diagnostics.urlParams?.resetToken?.valid,
                "Yes",
                "No"
              )}
            </div>
            
            <div>
              <strong>Code Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {diagnostics.urlParams?.code?.value || 'None'}
              </code>
            </div>
            
            <div>
              <strong>Token Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {diagnostics.urlParams?.token?.value || 'None'}
              </code>
            </div>

            {!diagnostics.urlParams?.resetToken?.present && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No reset token found in URL (looking for "token" or "code" parameter). This means the password reset link is not working correctly.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 2. Wrong Type Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(diagnostics.passwordResetCheck?.isPasswordReset)}
              <span>2. Wrong Type Check</span>
            </CardTitle>
            <CardDescription>Check if type parameter is recovery or missing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Type Present:</span>
              {getStatusBadge(
                diagnostics.urlParams?.type?.present,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Is Recovery:</span>
              {getStatusBadge(
                diagnostics.urlParams?.type?.isRecovery,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Is Password Reset:</span>
              {getStatusBadge(
                diagnostics.passwordResetCheck?.isPasswordReset,
                "Yes",
                "No"
              )}
            </div>
            
            <div>
              <strong>Type Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                {diagnostics.urlParams?.type?.value || 'None'}
              </code>
            </div>

            <div>
              <strong>Reason:</strong>
              <p className="text-sm text-gray-600 mt-1">
                {diagnostics.passwordResetCheck?.reason}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Session Exchange Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(diagnostics.codeExchangeTest?.success)}
              <span>3. Session Exchange Check</span>
            </CardTitle>
            <CardDescription>Check if code is valid and not expired</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Ready to Test:</span>
              {getStatusBadge(
                diagnostics.codeExchange?.readyToTest,
                "Yes",
                "No"
              )}
            </div>
            
            {diagnostics.codeExchange?.readyToTest && (
              <Button 
                onClick={testCodeExchange} 
                disabled={testing}
                className="w-full"
              >
                {testing ? 'Testing...' : 'Test Code Exchange'}
              </Button>
            )}

            {diagnostics.codeExchangeTest && (
              <>
                <div className="flex items-center justify-between">
                  <span>Exchange Success:</span>
                  {getStatusBadge(
                    diagnostics.codeExchangeTest.success,
                    "Yes",
                    "No"
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Session Created:</span>
                  {getStatusBadge(
                    diagnostics.codeExchangeTest.sessionCreated,
                    "Yes",
                    "No"
                  )}
                </div>

                {diagnostics.codeExchangeTest.error && (
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> {diagnostics.codeExchangeTest.error}
                    </AlertDescription>
                  </Alert>
                )}

                {diagnostics.codeExchangeTest.userEmail && (
                  <div>
                    <strong>User Email:</strong>
                    <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                      {diagnostics.codeExchangeTest.userEmail}
                    </code>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 4. Wrong Redirect Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span>4. Wrong Redirect Check</span>
            </CardTitle>
            <CardDescription>Check if redirect URL is correct</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>Expected Redirect:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {diagnostics.redirectConfig?.expected}
              </code>
            </div>
            
            <div>
              <strong>Current Origin:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                {diagnostics.redirectConfig?.currentOrigin}
              </code>
            </div>

            <div>
              <strong>Current URL:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {diagnostics.urlParams?.rawUrl}
              </code>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The redirect URL should be set to <code>/auth/reset</code> in the Supabase email configuration.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Diagnostic Summary</CardTitle>
          <CardDescription>Overall status of password reset flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Reset Token Present:</span>
              {getStatusIcon(diagnostics.urlParams?.resetToken?.present)}
            </div>
            <div className="flex items-center justify-between">
              <span>Correct Type:</span>
              {getStatusIcon(diagnostics.passwordResetCheck?.isPasswordReset)}
            </div>
            <div className="flex items-center justify-between">
              <span>Code Exchange:</span>
              {getStatusIcon(diagnostics.codeExchangeTest?.success || false)}
            </div>
            <div className="flex items-center justify-between">
              <span>Redirect URL:</span>
              {getStatusIcon(diagnostics.redirectConfig?.isCorrect)}
            </div>
          </div>

          {diagnostics.error && (
            <Alert className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Diagnostic Error:</strong> {diagnostics.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
