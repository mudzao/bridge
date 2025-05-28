import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, requireTenantAccess } from '@/middleware/auth.middleware';
import { queueService } from '@/services/queue.service';
import { 
  CreateJobRequest, 
  ApiResponse, 
  ValidationError,
  NotFoundError 
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
      const { sourceConnectorId, targetConnectorId, name, description } = request.body;
      const { userId, tenantId } = request.user!;

      // Validate connectors exist and belong to tenant
      const [sourceConnector, targetConnector] = await Promise.all([
        prisma.connector.findUnique({
          where: { id: sourceConnectorId, tenantId },
        }),
        prisma.connector.findUnique({
          where: { id: targetConnectorId, tenantId },
        }),
      ]);

      if (!sourceConnector) {
        throw new NotFoundError('Source connector not found');
      }

      if (!targetConnector) {
        throw new NotFoundError('Target connector not found');
      }

      // Create job record
      const job = await prisma.job.create({
        data: {
          name,
          description,
          sourceConnectorId,
          targetConnectorId,
          tenantId,
          userId,
          status: 'PENDING',
          statusMessage: 'Job created, waiting to start',
        },
      });

      // Add job to queue
      await queueService.addMigrationJob({
        ...request.body,
        jobId: job.id,
        tenantId,
        userId,
      });

      const response: ApiResponse = {
        success: true,
        data: job,
        message: 'Job created successfully',
      };

      return reply.status(201).send(response);
    } catch (error) {
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
        message: 'Failed to create job',
      });
    }
  });

  // Get all jobs for tenant
  fastify.get('/jobs', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const { tenantId } = request.user!;

      const jobs = await prisma.job.findMany({
        where: { tenantId },
        include: {
          sourceConnector: {
            select: { id: true, name: true, type: true },
          },
          targetConnector: {
            select: { id: true, name: true, type: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
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
      const { tenantId } = request.user!;

      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId },
        include: {
          sourceConnector: true,
          targetConnector: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          extractedData: true,
          loadingResults: true,
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
      const { tenantId } = request.user!;

      // Verify job belongs to tenant
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId },
        select: { id: true, status: true, statusMessage: true },
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
          statusMessage: job.statusMessage,
          progress: queueStatus?.progress || 0,
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
      const { tenantId } = request.user!;

      // Verify job belongs to tenant and can be cancelled
      const job = await prisma.job.findUnique({
        where: { id: jobId, tenantId },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
        throw new ValidationError('Job cannot be cancelled in current status');
      }

      // Update job status
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          statusMessage: 'Job cancelled by user',
          updatedAt: new Date(),
        },
      });

      // TODO: Cancel job in queue (BullMQ doesn't have direct cancel, but we can mark it)

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

  // Get job statistics
  fastify.get('/jobs/stats', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const { tenantId } = request.user!;

      // Get job counts by status
      const [pending, running, completed, failed, cancelled] = await Promise.all([
        prisma.job.count({ where: { tenantId, status: 'PENDING' } }),
        prisma.job.count({ where: { tenantId, status: 'RUNNING' } }),
        prisma.job.count({ where: { tenantId, status: 'COMPLETED' } }),
        prisma.job.count({ where: { tenantId, status: 'FAILED' } }),
        prisma.job.count({ where: { tenantId, status: 'CANCELLED' } }),
      ]);

      // Get queue statistics
      const queueStats = await queueService.getQueueStats();

      const response: ApiResponse = {
        success: true,
        data: {
          jobCounts: {
            pending,
            running,
            completed,
            failed,
            cancelled,
            total: pending + running + completed + failed + cancelled,
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
} 