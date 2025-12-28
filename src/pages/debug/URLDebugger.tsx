import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export default function URLDebugger() {
  const [searchParams] = useSearchParams();
  const [urlInfo, setUrlInfo] = useState<any>({});

  useEffect(() => {
    const info: any = {
      currentUrl: window.location.href,
      searchString: searchParams.toString(),
      allParams: Object.fromEntries(searchParams.entries()),
      hasToken: searchParams.has('token'),
      hasCode: searchParams.has('code'),
      hasType: searchParams.has('type'),
      hasError: searchParams.has('error'),
      tokenValue: searchParams.get('token'),
      codeValue: searchParams.get('code'),
      typeValue: searchParams.get('type'),
      errorValue: searchParams.get('error'),
    };

    // Check if this looks like a Supabase redirect
    info.isSupabaseRedirect = window.location.href.includes('supabase.co/auth/v1/verify');
    info.isDirectRedirect = window.location.href.includes('/auth/reset');
    
    // Check if we have any reset parameters
    info.hasResetParams = info.hasToken || info.hasCode;
    info.resetToken = info.tokenValue || info.codeValue;
    info.isPasswordReset = info.typeValue === 'recovery' || !info.typeValue;

    setUrlInfo(info);
  }, [searchParams]);

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">URL Debugger</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current URL Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-blue-500" />
              <span>Current URL Information</span>
            </CardTitle>
            <CardDescription>What the browser sees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>Full URL:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {urlInfo.currentUrl}
              </code>
            </div>
            
            <div>
              <strong>Search String:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                {urlInfo.searchString || 'None'}
              </code>
            </div>

            <div className="flex items-center justify-between">
              <span>Is Supabase Redirect:</span>
              {getStatusBadge(
                urlInfo.isSupabaseRedirect,
                "Yes",
                "No"
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Is Direct Redirect:</span>
              {getStatusBadge(
                urlInfo.isDirectRedirect,
                "Yes",
                "No"
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parameter Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(urlInfo.hasResetParams)}
              <span>Parameter Analysis</span>
            </CardTitle>
            <CardDescription>What parameters are present</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Has Token:</span>
              {getStatusBadge(
                urlInfo.hasToken,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Has Code:</span>
              {getStatusBadge(
                urlInfo.hasCode,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Has Type:</span>
              {getStatusBadge(
                urlInfo.hasType,
                "Yes",
                "No"
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>Has Error:</span>
              {getStatusBadge(
                urlInfo.hasError,
                "Yes",
                "No"
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Has Reset Params:</span>
              {getStatusBadge(
                urlInfo.hasResetParams,
                "Yes",
                "No"
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Is Password Reset:</span>
              {getStatusBadge(
                urlInfo.isPasswordReset,
                "Yes",
                "No"
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parameter Values */}
        <Card>
          <CardHeader>
            <CardTitle>Parameter Values</CardTitle>
            <CardDescription>Actual values of each parameter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>Token Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {urlInfo.tokenValue || 'None'}
              </code>
            </div>
            
            <div>
              <strong>Code Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {urlInfo.codeValue || 'None'}
              </code>
            </div>
            
            <div>
              <strong>Type Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                {urlInfo.typeValue || 'None'}
              </code>
            </div>
            
            <div>
              <strong>Error Value:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
                {urlInfo.errorValue || 'None'}
              </code>
            </div>

            <div>
              <strong>Reset Token:</strong>
              <code className="block mt-1 p-2 bg-gray-100 rounded text-sm break-all">
                {urlInfo.resetToken || 'None'}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* All Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>All Parameters</CardTitle>
            <CardDescription>Complete parameter object</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(urlInfo.allParams, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Debug Summary</CardTitle>
          <CardDescription>Overall status of the URL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Has Reset Parameters:</span>
              {getStatusIcon(urlInfo.hasResetParams)}
            </div>
            <div className="flex items-center justify-between">
              <span>Is Password Reset Type:</span>
              {getStatusIcon(urlInfo.isPasswordReset)}
            </div>
            <div className="flex items-center justify-between">
              <span>Has Valid Reset Token:</span>
              {getStatusIcon(!!urlInfo.resetToken)}
            </div>
          </div>

          {!urlInfo.hasResetParams && (
            <Alert className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Issue Found:</strong> No reset parameters found in URL. 
                This means the password reset link is not working correctly.
                <br /><br />
                <strong>Possible causes:</strong>
                <ul className="list-disc list-inside mt-2">
                  <li>Email link is malformed</li>
                  <li>Email client is modifying the URL</li>
                  <li>Supabase redirect is not working</li>
                  <li>Wrong redirect URL configuration</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {urlInfo.hasResetParams && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Good News:</strong> Reset parameters found! 
                The password reset link should work correctly.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
