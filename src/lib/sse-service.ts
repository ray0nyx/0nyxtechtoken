/**
 * Server-Sent Events (SSE) Service
 * 
 * Client for consuming SSE streams from backend
 */

export interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface SSESubscription {
  close: () => void;
  onMessage: (callback: (event: SSEEvent) => void) => void;
  onError: (callback: (error: Error) => void) => void;
}

/**
 * Subscribe to SSE stream
 */
export function subscribeToSSE(
  url: string,
  onMessage?: (event: SSEEvent) => void,
  onError?: (error: Error) => void
): SSESubscription {
  const eventSource = new EventSource(url);
  
  const subscription: SSESubscription = {
    close: () => {
      eventSource.close();
    },
    onMessage: (callback) => {
      eventSource.addEventListener('message', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          callback(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      });
    },
    onError: (callback) => {
      eventSource.addEventListener('error', (e: Event) => {
        callback(new Error('SSE connection error'));
      });
    },
  };
  
  // Set up default handlers
  if (onMessage) {
    subscription.onMessage(onMessage);
  }
  
  if (onError) {
    subscription.onError(onError);
  }
  
  return subscription;
}

/**
 * Subscribe to price updates via SSE
 */
export function subscribeToPriceUpdates(
  tokenAddress: string,
  onUpdate: (data: any) => void,
  onError?: (error: Error) => void
): SSESubscription {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  const url = `${apiUrl}/api/sse/price/${tokenAddress}`;
  
  return subscribeToSSE(
    url,
    (event) => {
      if (event.type === 'price_update') {
        onUpdate(event.data);
      }
    },
    onError
  );
}

/**
 * Subscribe to market data updates via SSE
 */
export function subscribeToMarketData(
  symbol: string,
  onUpdate: (data: any) => void,
  onError?: (error: Error) => void
): SSESubscription {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  const url = `${apiUrl}/api/sse/market/${symbol}`;
  
  return subscribeToSSE(
    url,
    (event) => {
      if (event.type === 'market_update') {
        onUpdate(event.data);
      }
    },
    onError
  );
}

/**
 * Subscribe to Axiom Pulse updates via SSE
 */
export function subscribeToPulseUpdates(
  category: 'new_pairs' | 'final_stretch' | 'migrated' | null,
  onUpdate: (data: any) => void,
  onError?: (error: Error) => void
): SSESubscription {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  const url = category
    ? `${apiUrl}/api/sse/pulse?category=${category}`
    : `${apiUrl}/api/sse/pulse`;
  
  return subscribeToSSE(
    url,
    (event) => {
      if (event.type === 'pulse_update') {
        onUpdate(event.data);
      }
    },
    onError
  );
}
