/**
 * Redis Job Queue Service
 * Handles backtest job orchestration with priority queuing and auto-scaling
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { createClient } from '@/lib/supabase/client';

export interface JobData {
  id: string;
  type: 'backtest' | 'data_fetch' | 'strategy_analysis' | 'cleanup';
  priority: number; // 1-10, higher = more priority
  data: any;
  userId: string;
  createdAt: Date;
  scheduledAt?: Date;
  maxAttempts: number;
  attempts: number;
  timeout: number; // in seconds
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface WorkerNode {
  id: string;
  type: 'backtest' | 'data' | 'general';
  status: 'active' | 'idle' | 'busy' | 'offline' | 'error';
  cpuUsage: number;
  memoryUsage: number;
  activeJobs: number;
  maxJobs: number;
  lastHeartbeat: Date;
}

export class JobQueueService extends EventEmitter {
  private redis: Redis;
  private supabase: any;
  private workers: Map<string, WorkerNode> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers() {
    this.redis.on('connect', () => {
      console.log('Redis connected');
      this.emit('redis:connected');
    });

    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
      this.emit('redis:error', error);
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
      this.emit('redis:closed');
    });
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobData: Omit<JobData, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: JobData = {
      ...jobData,
      id: jobId,
      createdAt: new Date(),
      attempts: 0,
    };

    try {
      // Store job in Redis with priority score
      const priorityScore = this.calculatePriorityScore(job);
      await this.redis.zadd('job_queue', priorityScore, JSON.stringify(job));
      
      // Store job details for tracking
      await this.redis.hset(`job:${jobId}`, {
        data: JSON.stringify(job),
        status: 'pending',
        createdAt: job.createdAt.toISOString(),
      });

      // Set expiration (24 hours)
      await this.redis.expire(`job:${jobId}`, 86400);

      // Persist to database for backup
      await this.persistJobToDatabase(job);

      this.emit('job:added', job);
      console.log(`Job ${jobId} added to queue with priority ${job.priority}`);

      return jobId;
    } catch (error) {
      console.error('Failed to add job:', error);
      throw new Error(`Failed to add job: ${error}`);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const jobData = await this.redis.hgetall(`job:${jobId}`);
      if (!jobData.data) {
        return null;
      }

      const job = JSON.parse(jobData.data);
      return {
        ...job,
        status: jobData.status,
        createdAt: new Date(jobData.createdAt),
      };
    } catch (error) {
      console.error('Failed to get job status:', error);
      return null;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Remove from queue
      const jobData = await this.redis.hgetall(`job:${jobId}`);
      if (jobData.data) {
        const job = JSON.parse(jobData.data);
        await this.redis.zrem('job_queue', JSON.stringify(job));
      }

      // Update status
      await this.redis.hset(`job:${jobId}`, 'status', 'cancelled');
      
      // Update database
      await this.updateJobStatus(jobId, 'cancelled');

      this.emit('job:cancelled', jobId);
      return true;
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }

  /**
   * Start processing jobs
   */
  startProcessing() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      await this.processNextJob();
    }, 1000); // Check every second

    console.log('Job processing started');
  }

  /**
   * Stop processing jobs
   */
  stopProcessing() {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('Job processing stopped');
  }

  /**
   * Process the next job in queue
   */
  private async processNextJob(): Promise<void> {
    try {
      // Get available worker
      const worker = this.getAvailableWorker();
      if (!worker) {
        return; // No available workers
      }

      // Get next job from queue
      const jobData = await this.redis.zpopmax('job_queue');
      if (!jobData || jobData.length === 0) {
        return; // No jobs in queue
      }

      const job: JobData = JSON.parse(jobData[0]);
      
      // Check if job has exceeded max attempts
      if (job.attempts >= job.maxAttempts) {
        await this.handleJobFailure(job, 'Max attempts exceeded');
        return;
      }

      // Check if job has timed out
      const now = new Date();
      const jobAge = now.getTime() - job.createdAt.getTime();
      if (jobAge > job.timeout * 1000) {
        await this.handleJobFailure(job, 'Job timeout');
        return;
      }

      // Update worker status
      worker.status = 'busy';
      worker.activeJobs++;

      // Update job status
      await this.redis.hset(`job:${job.id}`, 'status', 'processing');
      await this.updateJobStatus(job.id, 'processing');

      // Process job
      this.emit('job:processing', job);
      console.log(`Processing job ${job.id} on worker ${worker.id}`);

      const result = await this.executeJob(job, worker);
      
      if (result.success) {
        await this.handleJobSuccess(job, result);
      } else {
        await this.handleJobFailure(job, result.error || 'Unknown error');
      }

      // Update worker status
      worker.status = 'idle';
      worker.activeJobs--;

    } catch (error) {
      console.error('Error processing job:', error);
    }
  }

  /**
   * Execute a job based on its type
   */
  private async executeJob(job: JobData, worker: WorkerNode): Promise<JobResult> {
    const startTime = Date.now();

    try {
      switch (job.type) {
        case 'backtest':
          return await this.executeBacktestJob(job, worker);
        case 'data_fetch':
          return await this.executeDataFetchJob(job, worker);
        case 'strategy_analysis':
          return await this.executeStrategyAnalysisJob(job, worker);
        case 'cleanup':
          return await this.executeCleanupJob(job, worker);
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute backtest job
   */
  private async executeBacktestJob(job: JobData, worker: WorkerNode): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the LEAN service
      const leanServiceUrl = process.env.LEAN_SERVICE_URL || 'http://localhost:8000';
      
      const response = await fetch(`${leanServiceUrl}/backtest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${job.data.authToken}`,
        },
        body: JSON.stringify(job.data.backtestRequest),
      });

      if (!response.ok) {
        throw new Error(`LEAN service error: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Backtest execution failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute data fetch job
   */
  private async executeDataFetchJob(job: JobData, worker: WorkerNode): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the data service
      const dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://localhost:8001';
      
      const response = await fetch(`${dataServiceUrl}/fetch-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job.data),
      });

      if (!response.ok) {
        throw new Error(`Data service error: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Data fetch failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute strategy analysis job
   */
  private async executeStrategyAnalysisJob(job: JobData, worker: WorkerNode): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      // Calculate strategy performance score
      const { data } = await this.supabase.rpc('calculate_strategy_score', {
        p_strategy_id: job.data.strategyId,
        p_backtest_job_id: job.data.backtestJobId,
      });

      return {
        success: true,
        data: { score: data },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Strategy analysis failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute cleanup job
   */
  private async executeCleanupJob(job: JobData, worker: WorkerNode): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      // Clean up old jobs, temporary files, etc.
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      // Clean up Redis
      const oldJobs = await this.redis.keys('job:*');
      for (const jobKey of oldJobs) {
        const jobData = await this.redis.hgetall(jobKey);
        if (jobData.createdAt) {
          const createdAt = new Date(jobData.createdAt);
          if (createdAt < cutoffDate) {
            await this.redis.del(jobKey);
          }
        }
      }

      return {
        success: true,
        data: { cleanedJobs: oldJobs.length },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Handle successful job completion
   */
  private async handleJobSuccess(job: JobData, result: JobResult): Promise<void> {
    await this.redis.hset(`job:${job.id}`, 'status', 'completed');
    await this.updateJobStatus(job.id, 'completed');
    
    // Store result
    await this.redis.hset(`job:${job.id}`, 'result', JSON.stringify(result));
    
    this.emit('job:completed', { job, result });
    console.log(`Job ${job.id} completed successfully in ${result.duration}ms`);
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(job: JobData, error: string): Promise<void> {
    job.attempts++;
    
    if (job.attempts < job.maxAttempts) {
      // Retry job
      const delay = Math.pow(2, job.attempts) * 1000; // Exponential backoff
      setTimeout(async () => {
        const priorityScore = this.calculatePriorityScore(job);
        await this.redis.zadd('job_queue', priorityScore, JSON.stringify(job));
      }, delay);
      
      await this.redis.hset(`job:${job.id}`, 'status', 'retrying');
      await this.updateJobStatus(job.id, 'retrying');
      
      console.log(`Job ${job.id} failed, retrying in ${delay}ms (attempt ${job.attempts}/${job.maxAttempts})`);
    } else {
      // Mark as failed
      await this.redis.hset(`job:${job.id}`, 'status', 'failed');
      await this.redis.hset(`job:${job.id}`, 'error', error);
      await this.updateJobStatus(job.id, 'failed');
      
      this.emit('job:failed', { job, error });
      console.log(`Job ${job.id} failed permanently: ${error}`);
    }
  }

  /**
   * Get available worker
   */
  private getAvailableWorker(): WorkerNode | null {
    for (const worker of this.workers.values()) {
      if (worker.status === 'idle' && worker.activeJobs < worker.maxJobs) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Calculate priority score for job ordering
   */
  private calculatePriorityScore(job: JobData): number {
    // Higher priority = higher score
    // Time-based decay to prevent starvation
    const timeDecay = Math.max(0, (Date.now() - job.createdAt.getTime()) / 1000 / 60); // minutes
    return job.priority * 1000000 - timeDecay;
  }

  /**
   * Start worker heartbeat
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds
  }

  /**
   * Send worker heartbeat
   */
  private async sendHeartbeat() {
    try {
      const workerId = process.env.WORKER_ID || `worker_${Date.now()}`;
      const workerType = process.env.WORKER_TYPE || 'general';
      
      const worker: WorkerNode = {
        id: workerId,
        type: workerType as any,
        status: this.isProcessing ? 'busy' : 'idle',
        cpuUsage: await this.getCpuUsage(),
        memoryUsage: await this.getMemoryUsage(),
        activeJobs: this.workers.get(workerId)?.activeJobs || 0,
        maxJobs: parseInt(process.env.MAX_JOBS || '10'),
        lastHeartbeat: new Date(),
      };

      this.workers.set(workerId, worker);
      
      // Store in Redis
      await this.redis.hset(`worker:${workerId}`, {
        data: JSON.stringify(worker),
        lastHeartbeat: worker.lastHeartbeat.toISOString(),
      });
      
      // Update database
      await this.updateWorkerInDatabase(worker);
      
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    // This would use a system monitoring library in production
    return Math.random() * 100;
  }

  /**
   * Get memory usage percentage
   */
  private async getMemoryUsage(): Promise<number> {
    // This would use a system monitoring library in production
    return Math.random() * 100;
  }

  /**
   * Persist job to database
   */
  private async persistJobToDatabase(job: JobData): Promise<void> {
    try {
      await this.supabase.from('job_queue').insert({
        job_type: job.type,
        job_data: job.data,
        priority: job.priority,
        status: 'pending',
        scheduled_at: job.scheduledAt?.toISOString() || new Date().toISOString(),
        max_attempts: job.maxAttempts,
      });
    } catch (error) {
      console.error('Failed to persist job to database:', error);
    }
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    try {
      await this.supabase
        .from('job_queue')
        .update({ status })
        .eq('id', jobId);
    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  }

  /**
   * Update worker in database
   */
  private async updateWorkerInDatabase(worker: WorkerNode): Promise<void> {
    try {
      await this.supabase
        .from('worker_nodes')
        .upsert({
          node_id: worker.id,
          node_type: worker.type,
          status: worker.status,
          cpu_usage: worker.cpuUsage,
          memory_usage: worker.memoryUsage,
          active_jobs: worker.activeJobs,
          max_jobs: worker.maxJobs,
          last_heartbeat: worker.lastHeartbeat.toISOString(),
        });
    } catch (error) {
      console.error('Failed to update worker in database:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    try {
      const queueLength = await this.redis.zcard('job_queue');
      const activeWorkers = Array.from(this.workers.values()).filter(w => w.status === 'active').length;
      const totalWorkers = this.workers.size;
      
      return {
        queueLength,
        activeWorkers,
        totalWorkers,
        workers: Array.from(this.workers.values()),
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopProcessing();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    await this.redis.quit();
  }
}

// Export singleton instance
export const jobQueueService = new JobQueueService();
