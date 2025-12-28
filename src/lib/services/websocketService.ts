/**
 * WebSocket Service for Real-time Updates
 * Handles real-time communication for backtest progress, notifications, and live data
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: 'backtest_progress' | 'backtest_completed' | 'backtest_failed' | 'notification' | 'system_status';
  data: any;
  timestamp: Date;
  userId?: string;
  jobId?: string;
}

export interface BacktestProgressUpdate {
  jobId: string;
  userId: string;
  progress: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  estimatedTimeRemaining?: number;
  currentStep?: string;
  logs?: string[];
}

export interface SystemStatusUpdate {
  queueLength: number;
  activeWorkers: number;
  totalWorkers: number;
  systemLoad: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private redis: Redis;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private userSockets: Map<string, string> = new Map(); // socketId -> userId
  private isInitialized = false;

  constructor(httpServer: HTTPServer) {
    super();
    
    // Initialize Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Initialize Redis for pub/sub
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.setupEventHandlers();
    this.setupRedisSubscriptions();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', async (data: { token: string }) => {
        try {
          const userId = await this.authenticateUser(data.token);
          if (userId) {
            this.associateUserWithSocket(userId, socket.id);
            socket.emit('authenticated', { userId });
            console.log(`User ${userId} authenticated with socket ${socket.id}`);
          } else {
            socket.emit('authentication_failed', { message: 'Invalid token' });
          }
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authentication_failed', { message: 'Authentication error' });
        }
      });

      // Handle subscription to backtest updates
      socket.on('subscribe_backtest', (data: { jobId: string }) => {
        socket.join(`backtest:${data.jobId}`);
        console.log(`Socket ${socket.id} subscribed to backtest ${data.jobId}`);
      });

      // Handle unsubscription from backtest updates
      socket.on('unsubscribe_backtest', (data: { jobId: string }) => {
        socket.leave(`backtest:${data.jobId}`);
        console.log(`Socket ${socket.id} unsubscribed from backtest ${data.jobId}`);
      });

      // Handle subscription to user notifications
      socket.on('subscribe_notifications', (data: { userId: string }) => {
        socket.join(`user:${data.userId}`);
        console.log(`Socket ${socket.id} subscribed to notifications for user ${data.userId}`);
      });

      // Handle subscription to system status
      socket.on('subscribe_system_status', () => {
        socket.join('system_status');
        console.log(`Socket ${socket.id} subscribed to system status`);
      });

      // Handle custom events
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket.id);
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private setupRedisSubscriptions() {
    // Subscribe to backtest progress updates
    this.redis.subscribe('backtest:progress', (err) => {
      if (err) {
        console.error('Failed to subscribe to backtest progress:', err);
      } else {
        console.log('Subscribed to backtest progress updates');
      }
    });

    // Subscribe to system status updates
    this.redis.subscribe('system:status', (err) => {
      if (err) {
        console.error('Failed to subscribe to system status:', err);
      } else {
        console.log('Subscribed to system status updates');
      }
    });

    // Subscribe to notifications
    this.redis.subscribe('notifications', (err) => {
      if (err) {
        console.error('Failed to subscribe to notifications:', err);
      } else {
        console.log('Subscribed to notifications');
      }
    });

    // Handle incoming messages
    this.redis.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.handleRedisMessage(channel, data);
      } catch (error) {
        console.error('Failed to parse Redis message:', error);
      }
    });
  }

  private async handleRedisMessage(channel: string, data: any) {
    switch (channel) {
      case 'backtest:progress':
        await this.handleBacktestProgressUpdate(data);
        break;
      case 'system:status':
        await this.handleSystemStatusUpdate(data);
        break;
      case 'notifications':
        await this.handleNotificationUpdate(data);
        break;
    }
  }

  private async handleBacktestProgressUpdate(data: BacktestProgressUpdate) {
    // Send to specific backtest room
    this.io.to(`backtest:${data.jobId}`).emit('backtest_progress', {
      type: 'backtest_progress',
      data,
      timestamp: new Date(),
    });

    // Send to user's personal room
    this.io.to(`user:${data.userId}`).emit('backtest_progress', {
      type: 'backtest_progress',
      data,
      timestamp: new Date(),
    });

    console.log(`Sent backtest progress update for job ${data.jobId} to user ${data.userId}`);
  }

  private async handleSystemStatusUpdate(data: SystemStatusUpdate) {
    this.io.to('system_status').emit('system_status', {
      type: 'system_status',
      data,
      timestamp: new Date(),
    });

    console.log('Sent system status update');
  }

  private async handleNotificationUpdate(data: any) {
    if (data.userId) {
      // Send to specific user
      this.io.to(`user:${data.userId}`).emit('notification', {
        type: 'notification',
        data,
        timestamp: new Date(),
      });
    } else {
      // Broadcast to all users
      this.io.emit('notification', {
        type: 'notification',
        data,
        timestamp: new Date(),
      });
    }

    console.log(`Sent notification to user ${data.userId || 'all'}`);
  }

  private async authenticateUser(token: string): Promise<string | null> {
    try {
      // This would typically verify the JWT token with your auth service
      // For now, we'll use a simple validation
      if (token && token.length > 10) {
        // Extract user ID from token (this is simplified)
        return token.substring(0, 36); // Assuming UUID
      }
      return null;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  private associateUserWithSocket(userId: string, socketId: string) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
    this.userSockets.set(socketId, userId);
  }

  private handleDisconnection(socketId: string) {
    const userId = this.userSockets.get(socketId);
    if (userId) {
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
      this.userSockets.delete(socketId);
    }
  }

  /**
   * Send backtest progress update
   */
  async sendBacktestProgress(update: BacktestProgressUpdate) {
    try {
      // Publish to Redis for other instances
      await this.redis.publish('backtest:progress', JSON.stringify(update));
      
      // Also send directly to connected clients
      await this.handleBacktestProgressUpdate(update);
    } catch (error) {
      console.error('Failed to send backtest progress:', error);
    }
  }

  /**
   * Send system status update
   */
  async sendSystemStatus(update: SystemStatusUpdate) {
    try {
      await this.redis.publish('system:status', JSON.stringify(update));
    } catch (error) {
      console.error('Failed to send system status:', error);
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId: string, notification: any) {
    try {
      const data = { ...notification, userId };
      await this.redis.publish('notifications', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Send notification to all users
   */
  async broadcastNotification(notification: any) {
    try {
      await this.redis.publish('notifications', JSON.stringify(notification));
    } catch (error) {
      console.error('Failed to broadcast notification:', error);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get total connections count
   */
  getTotalConnectionsCount(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Get user connection info
   */
  getUserConnectionInfo(userId: string): { socketIds: string[]; isOnline: boolean } {
    const socketIds = Array.from(this.connectedUsers.get(userId) || []);
    return {
      socketIds,
      isOnline: socketIds.length > 0,
    };
  }

  /**
   * Force disconnect user
   */
  async disconnectUser(userId: string) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  /**
   * Get server statistics
   */
  getServerStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections: this.io.engine.clientsCount,
      rooms: this.io.sockets.adapter.rooms.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.redis.quit();
    this.io.close();
  }
}

// Export singleton instance
let websocketService: WebSocketService | null = null;

export function initializeWebSocketService(httpServer: HTTPServer): WebSocketService {
  if (!websocketService) {
    websocketService = new WebSocketService(httpServer);
  }
  return websocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return websocketService;
}
