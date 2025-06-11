import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '@/config';
import { CreateJobRequest, JobProgress } from '@/types';
import { PrismaClient } from '@prisma/client';
import { JobStatus } from '@/types';

const prisma = new PrismaClient();

// Redis connection for BullMQ
const redisConnection = new IORedis(redisConfig.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Job queue names
export const QUEUE_NAMES = {
  MIGRATION: 'migration-jobs',
  PROGRESS: 'progress-updates',
  CLEANUP: 'cleanup-jobs',
} as const;

// Job types
export const JOB_TYPES = {
  EXTRACT_DATA: 'extract-data',
  TRANSFORM_DATA: 'transform-data',
  LOAD_DATA: 'load-data',
  CLEANUP_DATA: 'cleanup-data',
  PROGRESS_UPDATE: 'progress-update',
} as const;

export class QueueService {
  private migrationQueue: Queue;
  private progressQueue: Queue;
  private cleanupQueue: Queue;

  constructor() {
    // Initialize queues
    this.migrationQueue = new Queue(QUEUE_NAMES.MIGRATION, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 50, // Keep last 50 completed jobs
        removeOnFail: 100,    // Keep last 100 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.progressQueue = new Queue(QUEUE_NAMES.PROGRESS, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
        attempts: 1, // Progress updates don't need retries
      },
    });

    this.cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
        attempts: 2,
        delay: 24 * 60 * 60 * 1000, // Run cleanup jobs daily
      },
    });
  }

  /**
   * Add a migration job to the queue
   */
  async addMigrationJob(jobData: CreateJobRequest & { 
    jobId: string; 
    tenantId: string; 
    userId: string; 
  }) {
    const job = await this.migrationQueue.add(
      JOB_TYPES.EXTRACT_DATA,
      jobData,
      {
        jobId: jobData.jobId,
        priority: this.getJobPriority(jobData.tenantId),
      }
    );

    return job;
  }

  /**
   * Add a progress update job
   */
  async addProgressUpdate(progressData: JobProgress) {
    const job = await this.progressQueue.add(
      JOB_TYPES.PROGRESS_UPDATE,
      progressData,
      {
        jobId: `progress-${progressData.jobId}-${Date.now()}`,
      }
    );

    return job;
  }

  /**
   * Add a cleanup job for expired data
   */
  async addCleanupJob(tenantId: string, dataType: string) {
    const job = await this.cleanupQueue.add(
      JOB_TYPES.CLEANUP_DATA,
      { tenantId, dataType },
      {
        jobId: `cleanup-${tenantId}-${dataType}-${Date.now()}`,
      }
    );

    return job;
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string) {
    const job = await this.migrationQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      opts: job.opts,
      attemptsMade: job.attemptsMade,
    };
  }

  /**
   * Cancel a job using hybrid Database + Redis caching approach
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      console.log(`🚫 Starting cancellation for job ${jobId}`);

      // Step 1: Update database (authoritative source of truth)
      try {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            error: 'Job cancelled by user',
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`✅ Database updated: job ${jobId} marked as FAILED`);
      } catch (dbError) {
        console.error(`❌ Failed to update database for job ${jobId}:`, dbError);
        return false;
      }

      // Step 2: Update Redis cache for fast worker access (5 minute TTL)
      try {
        await redisConnection.setex(`job:${jobId}:cancelled`, 300, 'true');
        console.log(`✅ Redis cache updated: job ${jobId} cancellation cached`);
      } catch (redisError) {
        console.warn(`⚠️ Redis cache update failed for job ${jobId}:`, redisError);
        // Don't fail the cancellation if Redis cache fails - database is source of truth
      }

      // Step 3: Try to update BullMQ job data (if job exists in queue)
      try {
        const job = await this.migrationQueue.getJob(jobId);
        
        if (job) {
          const jobState = await job.getState();
          console.log(`📊 BullMQ job ${jobId} state: ${jobState}`);

          if (jobState === 'active') {
            // For active jobs, first update job data to signal cancellation
            await job.updateData({
              ...job.data,
              cancelled: true,
              cancelledAt: new Date().toISOString(),
              cancelReason: 'User requested cancellation'
            });
            console.log(`✅ BullMQ job data updated for active job ${jobId}`);
            
            // Then forcefully fail the job to stop it immediately
            try {
              await job.moveToFailed(new Error('Job cancelled by user'), 'cancelled', true);
              console.log(`🚫 BullMQ job ${jobId} forcefully failed (cancelled)`);
            } catch (failError) {
              console.warn(`⚠️ Could not forcefully fail job ${jobId}:`, failError);
            }
          } else {
            // For waiting/delayed jobs, try to remove them
            await job.remove();
            console.log(`✅ BullMQ job ${jobId} removed from queue (state: ${jobState})`);
          }
        } else {
          console.log(`ℹ️ Job ${jobId} not found in BullMQ queue (may have completed)`);
        }
      } catch (bullmqError) {
        console.warn(`⚠️ BullMQ update failed for job ${jobId}:`, bullmqError);
        // Don't fail the cancellation if BullMQ update fails - database is source of truth
      }

      console.log(`🎯 Job ${jobId} cancellation completed successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Pause a specific job
   */
  async pauseJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.migrationQueue.getJob(jobId);
      
      if (!job) {
        console.warn(`Job ${jobId} not found in queue`);
        return false;
      }

      // Move job to delayed state (effectively pausing it)
      await job.moveToDelayed(Date.now() + 24 * 60 * 60 * 1000); // Delay 24 hours
      console.log(`Job ${jobId} paused`);
      return true;
    } catch (error) {
      console.error(`Failed to pause job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.migrationQueue.getJob(jobId);
      
      if (!job) {
        console.warn(`Job ${jobId} not found in queue`);
        return false;
      }

      // Move job back to waiting state
      await job.promote();
      console.log(`Job ${jobId} resumed`);
      return true;
    } catch (error) {
      console.error(`Failed to resume job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Force remove a job (even if running)
   */
  async forceRemoveJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.migrationQueue.getJob(jobId);
      
      if (!job) {
        console.warn(`Job ${jobId} not found in queue`);
        return false;
      }

      // Force remove the job
      await job.remove();
      console.log(`Job ${jobId} force removed from queue`);
      return true;
    } catch (error) {
      console.error(`Failed to force remove job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get all jobs in queue (for debugging)
   */
  async getAllJobs() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.migrationQueue.getWaiting(),
      this.migrationQueue.getActive(),
      this.migrationQueue.getCompleted(),
      this.migrationQueue.getFailed(),
    ]);

    return {
      waiting: waiting.map(job => ({ id: job.id, data: job.data })),
      active: active.map(job => ({ id: job.id, data: job.data })),
      completed: completed.map(job => ({ id: job.id, data: job.data })),
      failed: failed.map(job => ({ id: job.id, data: job.data })),
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [migrationStats, progressStats, cleanupStats] = await Promise.all([
      this.getQueueCounts(this.migrationQueue),
      this.getQueueCounts(this.progressQueue),
      this.getQueueCounts(this.cleanupQueue),
    ]);

    return {
      migration: migrationStats,
      progress: progressStats,
      cleanup: cleanupStats,
    };
  }

  /**
   * Get queue job counts
   */
  private async getQueueCounts(queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get job priority based on tenant tier (can be extended)
   */
  private getJobPriority(_tenantId: string): number {
    // Default priority - can be enhanced with tenant tier logic
    return 0;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string) {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.pause();
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string) {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.resume();
    }
  }

  /**
   * Get queue by name
   */
  private getQueueByName(queueName: string): Queue | null {
    switch (queueName) {
      case QUEUE_NAMES.MIGRATION:
        return this.migrationQueue;
      case QUEUE_NAMES.PROGRESS:
        return this.progressQueue;
      case QUEUE_NAMES.CLEANUP:
        return this.cleanupQueue;
      default:
        return null;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanupOldJobs() {
    const grace = 24 * 60 * 60 * 1000; // 24 hours
    
    await Promise.all([
      this.migrationQueue.clean(grace, 100, 'completed'),
      this.migrationQueue.clean(grace, 100, 'failed'),
      this.progressQueue.clean(grace, 50, 'completed'),
      this.cleanupQueue.clean(grace, 50, 'completed'),
    ]);
  }

  /**
   * Get all queues for Bull Board dashboard
   */
  getQueues() {
    return [this.migrationQueue, this.progressQueue, this.cleanupQueue];
  }

  /**
   * Close all queue connections
   */
  async close() {
    await Promise.all([
      this.migrationQueue.close(),
      this.progressQueue.close(),
      this.cleanupQueue.close(),
      redisConnection.disconnect(),
    ]);
  }
}

export const queueService = new QueueService(); 