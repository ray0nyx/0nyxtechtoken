import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Intercepts any URL that contains a Supabase recovery token (token/code)
 * and ensures we route it to `/auth/reset` so the dedicated handler can run.
 * This protects against misconfigured redirect URLs that land on `/` or elsewhere.
 */
export function RecoveryInterceptor() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(location.search || '');
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const type = searchParams.get('type');
      const hasResetToken = !!(token || code);

      // Consider it a password reset if type is recovery or missing (Supabase sometimes omits it)
      const isPasswordResetType = type === 'recovery' || !type;

      // If we detect a recovery token on any path other than the dedicated handler, redirect there
      if (
        hasResetToken &&
        isPasswordResetType &&
        location.pathname !== '/auth/reset'
      ) {
        // Preserve all query params
        navigate(`/auth/reset${location.search}`, { replace: true });
      }
    } catch (_) {
      // No-op: never block rendering
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default RecoveryInterceptor;


