import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { Alert, Button } from '@/components/ui'
import { DEVELOPER_IDS } from '@/hooks/useSubscription'

// Special users that don't need subscription
const EXEMPT_USERS = [
  '856950ff-d638-419d-bcf1-b7dac51d1c7f'
]

export function SubscriptionBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [daysLeft, setDaysLeft] = useState(0)
  const { supabase } = useSupabase()
  const navigate = useNavigate()

  useEffect(() => {
    async function checkSubscription() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || DEVELOPER_IDS.includes(user.id)) return

      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (subscription?.status === 'trialing') {
        const trialEnd = new Date(subscription.trial_end)
        const today = new Date()
        const days = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (days <= 3) {
          setDaysLeft(days)
          setShowBanner(true)
        }
      } else if (!subscription || subscription.status === 'expired') {
        setDaysLeft(0)
        setShowBanner(true)
      }
    }

    checkSubscription()
  }, [supabase])

  if (!showBanner) return null

  return (
    <Alert className="mb-4">
      <div className="flex items-center justify-between">
        <div>
          {daysLeft > 0 ? (
            <p>Your free trial expires in {daysLeft} days. Upgrade now to keep access to all features.</p>
          ) : (
            <p>Your subscription has expired. Upgrade now to regain access to all features.</p>
          )}
        </div>
        <Button
          variant="default"
          onClick={() => navigate('/pricing')}
        >
          Upgrade Now
        </Button>
      </div>
    </Alert>
  )
} 