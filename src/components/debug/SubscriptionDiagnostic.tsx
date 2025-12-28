import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function SubscriptionDiagnostic() {
  const { subscription, isLoading, isSubscriptionValid, isDeveloper } = useSubscription();
  const [user, setUser] = useState<any>(null);
  const [dbSubscription, setDbSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const { data: subData } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          
          setDbSubscription(subData);
        }
      } catch (error) {
        console.error('Error fetching diagnostic data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading diagnostic data...</div>;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Subscription Diagnostic</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">User Information</h3>
            <div className="space-y-1 text-sm">
              <p><strong>ID:</strong> {user?.id || 'Not authenticated'}</p>
              <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
              <p><strong>Authenticated:</strong> {user ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Subscription Status</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Context Valid:</strong> <Badge variant={isSubscriptionValid ? 'default' : 'destructive'}>{isSubscriptionValid ? 'Valid' : 'Invalid'}</Badge></p>
              <p><strong>Is Developer:</strong> <Badge variant={isDeveloper ? 'default' : 'secondary'}>{isDeveloper ? 'Yes' : 'No'}</Badge></p>
              <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Context Subscription Data</h3>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
            {JSON.stringify(subscription, null, 2)}
          </pre>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Database Subscription Data</h3>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
            {JSON.stringify(dbSubscription, null, 2)}
          </pre>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Refresh Page
          </Button>
          <Button 
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              console.log('Current user:', user);
              console.log('Subscription context:', { subscription, isSubscriptionValid, isDeveloper, isLoading });
              
              // Check if user is in developer list
              const developerIds = [
                '856950ff-d638-419d-bcf1-b7dac51d1c7f'
              ];
              console.log('Developer check:', {
                userId: user?.id,
                isInDeveloperList: user?.id ? developerIds.includes(user.id) : false,
                developerIds
              });
            }}
            variant="outline"
          >
            Log to Console
          </Button>
          <Button 
            onClick={async () => {
              // Force refresh subscription
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: subData } = await supabase
                  .from('user_subscriptions')
                  .select('*')
                  .eq('user_id', user.id)
                  .maybeSingle();
                console.log('Direct DB query result:', subData);
              }
            }}
            variant="outline"
          >
            Check DB Direct
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
