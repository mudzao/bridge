import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, requireTenantAccess, getUser } from '@/middleware/auth.middleware';
import { queueService } from '@/services/queue.service';
import { 
  CreateJobRequest, 
  ApiResponse, 
  ValidationError,
  NotFoundError,
  JobStatus,
  JobType
} from '@/types';

const prisma = new PrismaClient();

export async function jobRoutes(fastify: FastifyInstance) {
  // Create a new migration job
  fastify.post<{
    Body: CreateJobRequest;
  }>('/jobs', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      console.log('=== JOB CREATION REQUEST ===');
      console.log('Request body:', JSON.stringify(request.body, null, 2));
      
      const { jobType, sourceConnectorId, targetConnectorId, destinationConnectorId, entities, options } = request.body;
      const user = getUser(request);

      console.log('User info:', { userId: user.userId, tenantId: user.tenantId });

      // Handle legacy targetConnectorId field
      const destConnectorId = destinationConnectorId || targetConnectorId;

      // Map config to options (frontend sends config, database expects options)
      const jobOptions = options || (request.body as any).config || {};

      // Validate job type specific requirements
      if (jobType === JobType.MIGRATION && !destConnectorId) {
        throw new ValidationError('Destination connector is required for migration jobs');
      }

      console.log('=== CONNECTOR VALIDATION ===');
      // Validate connectors exist and belong to tenant
      const [sourceConnector, targetConnector] = await Promise.all([
        prisma.tenantConnector.findUnique({
          where: { id: sourceConnectorId, tenantId: user.tenantId },
        }),
        destConnectorId ? prisma.tenantConnector.findUnique({
          where: { id: destConnectorId, tenantId: user.tenantId },
        }) : null,
      ]);

      console.log('Source connector:', sourceConnector?.id);
      console.log('Target connector:', targetConnector?.id);

      if (!sourceConnector) {
        throw new NotFoundError('Source connector not found');
      }

      if (destConnectorId && !targetConnector) {
        throw new NotFoundError('Target connector not found');
      }

      console.log('=== JOB CREATION ===');
      // Create job record (simplified without jobType for now)
      const jobData = {
        sourceConnectorId,
        destinationConnectorId: destConnectorId || null,
        entities,
        options: jobOptions,
        tenantId: user.tenantId,
        status: JobStatus.QUEUED,
      };
      
      console.log('Job data to create:', JSON.stringify(jobData, null, 2));

      const job = await prisma.job.create({
        data: jobData,
      });

      console.log('Job created with ID:', job.id);

      // Add job to queue
      console.log('=== QUEUE ADDITION ===');
      await queueService.addMigrationJob({
        ...request.body,
        jobId: job.id,
        tenantId: user.tenantId,
        userId: user.userId,
      });

      console.log('Job added to queue successfully');

      const response: ApiResponse = {
        success: true,
        data: job,
        message: `${jobType?.toLowerCase() || 'extraction'} job created successfully`,
      };

      return reply.status(201).send(response);
    } catch (error: any) {
      console.error('=== JOB CREATION ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Create job error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create job: ' + (error.message || 'Unknown error'),
      });
    }
  });

  // Get all jobs for tenant
  fastify.get('/jobs', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const user = getUser(request);

      const jobs = await prisma.job.findMany({
        where: { tenantId: user.tenantId },
        include: {
          sourceConnector: {
            select: { id: true, name: true, connectorType: true },
          },
          destinationConnector: {
            select: { id: true, name: true, connectorType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const response: ApiResponse = {
        success: true,
        data: jobs,
        message: 'Jobs retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Get jobs error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve jobs',
      });
    }
  });

  // Get specific job by ID
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
        include: {
          sourceConnector: true,
          destinationConnector: true,
          extractedData: true,
        },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      // Get queue status
      const queueStatus = await queueService.getJobStatus(jobId);

      const response: ApiResponse = {
        success: true,
        data: {
          ...job,
          queueStatus,
        },
        message: 'Job retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Get job error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve job',
      });
    }
  });

  // Get job progress
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/progress', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Verify job belongs to tenant
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
        select: { id: true, status: true, progress: true },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      // Get queue progress
      const queueStatus = await queueService.getJobStatus(jobId);

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          status: job.status,
          progress: job.progress || {},
          queueInfo: queueStatus,
        },
        message: 'Job progress retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Get job progress error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve job progress',
      });
    }
  });

  // Cancel a job
  fastify.post<{
    Params: { jobId: string };
  }>('/jobs/:jobId/cancel', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);
      
      console.log(`🔥 CANCEL REQUEST RECEIVED for job ${jobId} by user ${user.userId}`);

      // Verify job belongs to tenant and can be cancelled
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(job.status as JobStatus)) {
        throw new ValidationError('Job cannot be cancelled in current status');
      }

      // Cancel job using hybrid approach (database + Redis cache + BullMQ)
      const queueCancelled = await queueService.cancelJob(jobId);
      
      if (!queueCancelled) {
        throw new Error('Failed to cancel job in queue');
      }

      console.log(`✅ Job ${jobId} cancelled successfully through QueueService`);

      const response: ApiResponse = {
        success: true,
        message: 'Job cancelled successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Cancel job error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to cancel job',
      });
    }
  });

  // Force delete a job (admin function)
  fastify.delete<{
    Params: { jobId: string };
  }>('/jobs/:jobId/force', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      console.log(`Force deleting job ${jobId}`);

      // Force remove from queue first
      const queueRemoved = await queueService.forceRemoveJob(jobId);
      
      // Delete from database (cascade delete related data)
      await prisma.job.delete({
        where: { id: jobId, tenantId: user.tenantId },
      });

      console.log(`Job ${jobId} force deleted - Queue: ${queueRemoved ? 'Removed' : 'Not found'}, DB: Deleted`);

      const response: ApiResponse = {
        success: true,
        data: { deletedJobId: jobId },
        message: 'Job force deleted successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: 'Job not found',
        });
      }

      console.error('Force delete job error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to force delete job',
      });
    }
  });

  // Get job statistics
  fastify.get('/jobs/stats', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const user = getUser(request);

      // Get job counts by status
      const [queued, running, extracting, dataReady, loading, completed, failed] = await Promise.all([
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.QUEUED } }),
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.RUNNING } }),
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.EXTRACTING } }),
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.DATA_READY } }),
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.LOADING } }),
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.COMPLETED } }),
        prisma.job.count({ where: { tenantId: user.tenantId, status: JobStatus.FAILED } }),
      ]);

      // Get queue statistics
      const queueStats = await queueService.getQueueStats();

      const response: ApiResponse = {
        success: true,
        data: {
          jobCounts: {
            queued,
            running,
            extracting,
            dataReady,
            loading,
            completed,
            failed,
            total: queued + running + extracting + dataReady + loading + completed + failed,
          },
          queueStats,
        },
        message: 'Job statistics retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Get job stats error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve job statistics',
      });
    }
  });

  // Server-Sent Events endpoint for real-time job progress
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/stream', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Verify job belongs to tenant
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
      });

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: 'Job not found',
        });
      }

      // Import SSE service
      const { SSEService } = await import('@/services/sse.service');
      const sseService = SSEService.getInstance();

      // Generate unique client ID
      const clientId = `${user.userId}-${jobId}-${Date.now()}`;

      // Add client to SSE service
      sseService.addClient(clientId, jobId, user.tenantId, reply);

      // Send current job status immediately
      const currentProgress = job.progress as any;
      if (currentProgress) {
        await sseService.broadcastProgress({
          jobId,
          tenantId: user.tenantId,
          type: 'progress',
          data: {
            progress: currentProgress.percentage || 0,
            status: job.status,
            message: currentProgress.message || `Job is ${job.status.toLowerCase()}`,
            phase: currentProgress.phase,
            recordsProcessed: currentProgress.recordsProcessed || 0,
            totalRecords: currentProgress.totalRecords,
            currentEntity: currentProgress.currentEntity,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Keep connection alive - don't return anything here
      // The SSE service handles the connection
    } catch (error) {
      fastify.log.error('SSE stream error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to establish progress stream',
      });
    }
  });

  // Get rate limiting statistics
  fastify.get('/jobs/rate-limits', {
    preHandler: [authenticateUser],
  }, async (_request, reply) => {
    try {
      const { rateLimiterService } = await import('@/services/rate-limiter.service');
      const rateLimitStats = await rateLimiterService.getAllRateLimitStats();

      const response: ApiResponse = {
        success: true,
        data: rateLimitStats,
        message: 'Rate limit statistics retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Get rate limit stats error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve rate limit statistics',
      });
    }
  });

  // Get minute-by-minute progress data for charts
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/minute-progress', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Verify job belongs to tenant
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
        select: { id: true },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      // Import timeline service
      const { TimelineService } = await import('@/services/timeline.service');
      const minuteProgress = await TimelineService.getMinuteProgress(jobId, user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: minuteProgress,
        message: 'Minute progress data retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Get minute progress error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve minute progress data',
      });
    }
  });

  // Get real job statistics with extraction and migration data
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/statistics', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Get job with extracted data and load results
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
        include: {
          extractedData: {
            include: {
              loadResults: true,
            },
          },
        },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      // Aggregate statistics by entity type
      const entityStats: Record<string, {
        entityType: string;
        totalRecords: number;
        extractionSuccess: number;
        extractionFailed: number;
        migrationSuccess: number;
        migrationFailed: number;
      }> = {};

      // Process extracted data
      job.extractedData.forEach(extractedData => {
        const entityType = extractedData.entityType;
        
        if (!entityStats[entityType]) {
          entityStats[entityType] = {
            entityType,
            totalRecords: 0,
            extractionSuccess: 0,
            extractionFailed: 0,
            migrationSuccess: 0,
            migrationFailed: 0,
          };
        }

        // Add extraction data
        entityStats[entityType].totalRecords += extractedData.recordCount;
        entityStats[entityType].extractionSuccess += extractedData.recordCount;
        
        // Add migration/loading data from load results
        if (extractedData.loadResults) {
          extractedData.loadResults.forEach(loadResult => {
            entityStats[entityType]!.migrationSuccess += loadResult.successCount ?? 0;
            entityStats[entityType]!.migrationFailed += loadResult.failedCount ?? 0;
          });
        }
      });

      // Convert to array and add any entities that were planned but had no data
      const entityStatsArray = Object.values(entityStats);
      
      // Add entities from job.entities that might not have extraction data yet
      job.entities?.forEach(entityType => {
        if (!entityStats[entityType]) {
          entityStatsArray.push({
            entityType,
            totalRecords: 0,
            extractionSuccess: 0,
            extractionFailed: 0,
            migrationSuccess: 0,
            migrationFailed: 0,
          });
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          status: job.status,
          entities: entityStatsArray,
          summary: {
            totalEntities: entityStatsArray.length,
            totalRecords: entityStatsArray.reduce((sum, e) => sum + e.totalRecords, 0),
            totalExtractionSuccess: entityStatsArray.reduce((sum, e) => sum + e.extractionSuccess, 0),
            totalExtractionFailed: entityStatsArray.reduce((sum, e) => sum + e.extractionFailed, 0),
            totalMigrationSuccess: entityStatsArray.reduce((sum, e) => sum + e.migrationSuccess, 0),
            totalMigrationFailed: entityStatsArray.reduce((sum, e) => sum + e.migrationFailed, 0),
          },
        },
        message: 'Job statistics retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Get job statistics error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve job statistics',
      });
    }
  });

  // Get job timeline events
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/timeline', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Verify job belongs to tenant
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId: user.tenantId },
        select: { id: true },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      // Import timeline service
      const { TimelineService } = await import('@/services/timeline.service');
      const timeline = await TimelineService.getJobTimeline(jobId, user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: timeline,
        message: 'Job timeline retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Get job timeline error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve job timeline',
      });
    }
  });
} 