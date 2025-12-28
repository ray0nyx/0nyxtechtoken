import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function UserIDDisplay() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error getting user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, []);

  if (loading) {
    return <div>Loading user info...</div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Your User Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p><strong>User ID:</strong> {user?.id || 'Not authenticated'}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Authenticated:</strong> {user ? 'Yes' : 'No'}</p>
        </div>
        {user?.id && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="text-sm font-mono break-all">
              Copy this ID: {user.id}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
