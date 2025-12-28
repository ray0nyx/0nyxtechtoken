/**
 * WebSocket Hook for Real-time Updates
 * Handles connection to WebSocket service for backtest progress and notifications
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  userId?: string;
  jobId?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000
  } = options;

  const { user, getToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  const connect = useCallback(async () => {
    if (socketRef.current?.connected || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get authentication token
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create socket connection
      const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8002', {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });

      socketRef.current = socket;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        setError(null);
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Attempt to reconnect if not manually disconnected
        if (reason !== 'io client disconnect' && reconnectAttempts < reconnectAttempts) {
          scheduleReconnect();
        }
      });

      socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err);
        setError(err.message);
        setIsConnecting(false);
        
        // Attempt to reconnect
        if (reconnectAttempts < reconnectAttempts) {
          scheduleReconnect();
        }
      });

      socket.on('authenticated', (data) => {
        console.log('WebSocket authenticated:', data);
      });

      socket.on('authentication_failed', (data) => {
        console.error('WebSocket authentication failed:', data);
        setError('Authentication failed');
        setIsConnecting(false);
      });

      // Generic message handler
      socket.onAny((eventName, data) => {
        console.log('WebSocket message received:', eventName, data);
        
        // Call registered handlers for this event
        const handlers = messageHandlersRef.current.get(eventName);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });
        }
      });

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnecting(false);
      
      // Attempt to reconnect
      if (reconnectAttempts < reconnectAttempts) {
        scheduleReconnect();
      }
    }
  }, [user, getToken, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setReconnectAttempts(0);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connect();
    }, reconnectInterval);
  }, [connect, reconnectInterval]);

  const subscribe = useCallback((eventName: string, handler: (data: any) => void) => {
    if (!messageHandlersRef.current.has(eventName)) {
      messageHandlersRef.current.set(eventName, new Set());
    }
    
    messageHandlersRef.current.get(eventName)!.add(handler);

    // Subscribe to the event on the socket
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { event: eventName });
    }

    // Return unsubscribe function
    return () => {
      const handlers = messageHandlersRef.current.get(eventName);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(eventName);
        }
      }

      // Unsubscribe from the event on the socket
      if (socketRef.current?.connected) {
        socketRef.current.emit('unsubscribe', { event: eventName });
      }
    };
  }, []);

  const emit = useCallback((eventName: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(eventName, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', eventName);
    }
  }, []);

  // Auto-connect when user is available
  useEffect(() => {
    if (autoConnect && user && !socketRef.current) {
      connect();
    }
  }, [autoConnect, user, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Expose socket instance for advanced usage
  const socket = socketRef.current;

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    subscribe,
    emit,
    reconnectAttempts
  };
};

// Convenience hooks for specific event types
export const useBacktestProgress = (jobId?: string) => {
  const { subscribe } = useWebSocket();
  const [progress, setProgress] = useState<{
    jobId: string;
    progress: number;
    status: string;
    message?: string;
    currentStep?: string;
  } | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = subscribe('backtest_progress', (data) => {
      if (data.jobId === jobId) {
        setProgress(data);
      }
    });

    return unsubscribe;
  }, [jobId, subscribe]);

  return progress;
};

export const useBacktestCompleted = (jobId?: string) => {
  const { subscribe } = useWebSocket();
  const [completed, setCompleted] = useState<{
    jobId: string;
    results: any;
    duration: number;
  } | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = subscribe('backtest_completed', (data) => {
      if (data.jobId === jobId) {
        setCompleted(data);
      }
    });

    return unsubscribe;
  }, [jobId, subscribe]);

  return completed;
};

export const useBacktestFailed = (jobId?: string) => {
  const { subscribe } = useWebSocket();
  const [failed, setFailed] = useState<{
    jobId: string;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = subscribe('backtest_failed', (data) => {
      if (data.jobId === jobId) {
        setFailed(data);
      }
    });

    return unsubscribe;
  }, [jobId, subscribe]);

  return failed;
};

export const useNotifications = () => {
  const { subscribe } = useWebSocket();
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>>([]);

  useEffect(() => {
    const unsubscribe = subscribe('notification', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    return unsubscribe;
  }, [subscribe]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    markAsRead,
    clearNotifications
  };
};

export const useSystemStatus = () => {
  const { subscribe } = useWebSocket();
  const [status, setStatus] = useState<{
    queueLength: number;
    activeWorkers: number;
    totalWorkers: number;
    systemLoad: number;
    memoryUsage: number;
    cpuUsage: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe('system_status', (data) => {
      setStatus(data);
    });

    return unsubscribe;
  }, [subscribe]);

  return status;
};

export default useWebSocket;
