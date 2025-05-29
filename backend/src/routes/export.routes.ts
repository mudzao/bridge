import { FastifyInstance } from 'fastify';
import { authenticateUser, requireTenantAccess, getUser } from '@/middleware/auth.middleware';
import { csvExportService } from '@/services/csv-export.service';
import {
  ApiResponse,
} from '@/types';

export async function exportRoutes(fastify: FastifyInstance) {
  // Get extraction summary for a job
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/extraction-summary', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Validate job access
      await csvExportService.validateJobAccess(jobId, user.tenantId);

      // Get extraction summary
      const summary = await csvExportService.getExtractionSummary(jobId, user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          extractedEntities: summary,
          totalRecords: summary.reduce((sum, s) => sum + s.recordCount, 0),
          entityTypes: summary.map(s => s.entityType),
        },
        message: 'Extraction summary retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error.message.includes('not ready for export')) {
        return reply.status(400).send({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
      }

      fastify.log.error('Get extraction summary error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve extraction summary',
      });
    }
  });

  // Get data preview for validation
  fastify.get<{
    Params: { jobId: string; entityType: string };
    Querystring: { limit?: string };
  }>('/jobs/:jobId/preview/:entityType', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId, entityType } = request.params;
      const { limit } = request.query;
      const user = getUser(request);

      // Validate job access
      await csvExportService.validateJobAccess(jobId, user.tenantId);

      // Get data preview
      const preview = await csvExportService.getDataPreview(
        jobId,
        user.tenantId,
        entityType,
        parseInt(limit || '5')
      );

      const response: ApiResponse = {
        success: true,
        data: preview,
        message: 'Data preview retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      fastify.log.error('Get data preview error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve data preview',
      });
    }
  });

  // Download CSV for specific entity type
  fastify.get<{
    Params: { jobId: string; entityType: string };
    Querystring: { 
      format?: 'csv' | 'json';
      includeRawData?: string;
    };
  }>('/jobs/:jobId/download/csv/:entityType', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId, entityType } = request.params;
      const { format = 'csv', includeRawData } = request.query;
      const user = getUser(request);

      // Validate job access
      const job = await csvExportService.validateJobAccess(jobId, user.tenantId);

      // Generate CSV
      const csvBuffer = await csvExportService.generateEntityCSV({
        jobId,
        tenantId: user.tenantId,
        entityType,
        format: format as 'csv' | 'json',
        includeRawData: includeRawData === 'true',
      });

      // Set response headers for file download
      const filename = `${job.sourceConnector.name}_${entityType}_${new Date().toISOString().slice(0, 10)}.csv`;
      
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', csvBuffer.length);

      return reply.send(csvBuffer);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error.message.includes('not ready for export')) {
        return reply.status(400).send({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
      }

      fastify.log.error('Download CSV error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate CSV download',
      });
    }
  });

  // Download full export (ZIP with all entity CSVs)
  fastify.get<{
    Params: { jobId: string };
    Querystring: { 
      format?: 'csv' | 'json';
      includeRawData?: string;
    };
  }>('/jobs/:jobId/download/full', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const { format = 'csv', includeRawData } = request.query;
      const user = getUser(request);

      // Validate job access
      const job = await csvExportService.validateJobAccess(jobId, user.tenantId);

      // Generate full export ZIP
      const zipBuffer = await csvExportService.generateFullExport({
        jobId,
        tenantId: user.tenantId,
        format: format as 'csv' | 'json',
        includeRawData: includeRawData === 'true',
      });

      // Set response headers for ZIP download
      const filename = `${job.sourceConnector.name}_full_export_${new Date().toISOString().slice(0, 10)}.zip`;
      
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', zipBuffer.length);

      return reply.send(zipBuffer);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error.message.includes('not ready for export')) {
        return reply.status(400).send({
          success: false,
          error: 'Bad Request',
          message: error.message,
        });
      }

      fastify.log.error('Download full export error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate full export',
      });
    }
  });

  // Stream CSV download for large datasets
  fastify.get<{
    Params: { jobId: string; entityType: string };
    Querystring: { 
      includeRawData?: string;
    };
  }>('/jobs/:jobId/download/stream/:entityType', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId, entityType } = request.params;
      const { includeRawData } = request.query;
      const user = getUser(request);

      // Validate job access
      const job = await csvExportService.validateJobAccess(jobId, user.tenantId);

      // Set response headers for streaming
      const filename = `${job.sourceConnector.name}_${entityType}_${new Date().toISOString().slice(0, 10)}.csv`;
      
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Transfer-Encoding', 'chunked');

      // Get streaming CSV
      const csvStream = await csvExportService.streamEntityCSV({
        jobId,
        tenantId: user.tenantId,
        entityType,
        includeRawData: includeRawData === 'true',
      });

      return reply.send(csvStream);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      fastify.log.error('Stream CSV error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to stream CSV download',
      });
    }
  });

  // Get available entity types for a job
  fastify.get<{
    Params: { jobId: string };
  }>('/jobs/:jobId/entities', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { jobId } = request.params;
      const user = getUser(request);

      // Validate job access
      await csvExportService.validateJobAccess(jobId, user.tenantId);

      // Get available entity types
      const entityTypes = await csvExportService.getAvailableEntityTypes(jobId, user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          entityTypes,
          count: entityTypes.length,
        },
        message: 'Available entity types retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      fastify.log.error('Get entity types error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve entity types',
      });
    }
  });
} 