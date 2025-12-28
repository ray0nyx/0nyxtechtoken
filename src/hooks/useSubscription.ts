import { useEffect, useState } from 'react'
import { useSupabase } from './useSupabase'
import { useToast } from '@/components/ui/use-toast'

// Special users with developer access
export const DEVELOPER_IDS = [
  '856950ff-d638-419d-bcf1-b7dac51d1c7f'
]

interface Subscription {
  status: 'trialing' | 'active' | 'expired' | 'developer';
  trial_end?: string;
  current_period_end?: string;
}

export function useSubscription() {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSubscription() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setSubscription(null)
          return
        }

        // Check if user is a developer
        if (DEVELOPER_IDS.includes(user.id)) {
          setSubscription({
            status: 'developer',
            trial_end: undefined,
            current_period_end: undefined
          })
          return
        }

        // For regular users, check subscription status
        const { data: sub, error } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        setSubscription(sub || {
          status: 'trialing',
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
      } catch (error) {
        console.error('Error checking subscription:', error)
        toast({
          title: 'Error',
          description: 'Failed to load subscription details',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    checkSubscription()

    // Subscribe to changes
    const channel = supabase
      .channel('subscription_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
        },
        () => {
          checkSubscription()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [supabase, toast])

  const hasAccess = Boolean(
    subscription && (
      subscription.status === 'developer' ||
      subscription.status === 'active' ||
      (subscription.status === 'trialing' && new Date(subscription.trial_end!) > new Date())
    )
  )

  const isTrialing = subscription?.status === 'trialing'
  const isDeveloper = subscription?.status === 'developer'

  const trialDaysLeft = subscription?.trial_end
    ? Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return {
    subscription,
    loading,
    hasAccess,
    isTrialing,
    isDeveloper,
    trialDaysLeft
  }
} 