import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export function Analytics() {
  return (
    <>
      {/* Set debug mode to true in development to test, auto in production */}
      <VercelAnalytics 
        debug={process.env.NODE_ENV === 'development'}
        mode={process.env.NODE_ENV === 'production' ? 'auto' : 'development'}
      />
      <SpeedInsights />
    </>
  );
} 