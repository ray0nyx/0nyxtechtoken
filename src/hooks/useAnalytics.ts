import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { trackEvent, trackFeatureUse } from '@/utils/analytics';

/**
 * A hook that provides analytics tracking functions for components
 * 
 * This hook automatically tracks events with the current user ID and page path,
 * making it easy to use analytics tracking in any component.
 */
export function useAnalytics() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Track a general event
  const trackUserEvent = useCallback((
    eventType: string,
    eventDetails?: Record<string, any>
  ) => {
    if (user?.id) {
      return trackEvent(
        user.id,
        eventType as any,
        { 
          ...eventDetails,
          page_path: location.pathname 
        }
      );
    }
    return Promise.resolve();
  }, [user?.id, location.pathname]);
  
  // Track feature usage
  const trackFeature = useCallback((
    featureName: string,
    featureDetails?: Record<string, any>
  ) => {
    if (user?.id) {
      return trackFeatureUse(
        user.id,
        featureName,
        { 
          ...featureDetails,
          page_path: location.pathname 
        }
      );
    }
    return Promise.resolve();
  }, [user?.id, location.pathname]);
  
  return {
    // Core tracking functions
    trackEvent: trackUserEvent,
    trackFeature,
    
    // Helper functions for common events
    trackClick: (elementId: string, details?: Record<string, any>) => 
      trackUserEvent('click', { element_id: elementId, ...details }),
    
    trackView: (viewName: string, details?: Record<string, any>) =>
      trackUserEvent('view', { view_name: viewName, ...details }),
    
    trackError: (errorMessage: string, details?: Record<string, any>) =>
      trackUserEvent('error', { error_message: errorMessage, ...details }),
    
    trackSearch: (query: string, details?: Record<string, any>) =>
      trackUserEvent('search', { search_query: query, ...details }),
    
    trackFilter: (filters: Record<string, any>) =>
      trackUserEvent('filter', { filters }),
      
    trackSort: (sortField: string, sortOrder: 'asc' | 'desc', details?: Record<string, any>) =>
      trackUserEvent('sort', { sort_field: sortField, sort_order: sortOrder, ...details }),
  };
}

export default useAnalytics; 