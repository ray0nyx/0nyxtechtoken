import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestApp() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Test App - You're In!</CardTitle>
        </CardHeader>
        <CardContent>
          <p>If you can see this, the authentication is working correctly.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Current URL: {window.location.pathname}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
