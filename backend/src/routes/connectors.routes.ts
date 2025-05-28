import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate, getUser } from '@/middleware/auth.middleware';
import { ConnectorService } from '@/services/connector.service';
import { 
  CreateConnectorRequest,
  UpdateConnectorRequest,
  TestConnectorResponse,
  ApiResponse 
} from '@/types';

const prisma = new PrismaClient();

export async function connectorRoutes(fastify: FastifyInstance) {
  // Create connector
  fastify.post('/connectors', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, connectorType, config } = request.body as CreateConnectorRequest;
      const user = getUser(request);

      // Validate connector configuration
      const validation = ConnectorService.validateConnectorConfig(connectorType, config);
      if (!validation.valid) {
        return reply.code(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid connector configuration',
          details: validation.errors,
        });
      }

      // Create connector
      const connector = await prisma.tenantConnector.create({
        data: {
          tenantId: user.tenantId,
          name,
          connectorType: connectorType as any,
          config,
          status: 'DISABLED', // Start as disabled until tested
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...connector,
          config: JSON.parse(JSON.stringify(connector.config)),
        },
        message: 'Connector created successfully',
      };

      reply.send(response);
    } catch (error) {
      console.error('Error creating connector:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to create connector',
      });
    }
  });

  // Get all connectors
  fastify.get('/connectors', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getUser(request);

      const connectors = await prisma.tenantConnector.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const connectorsWithParsedConfig = connectors.map(connector => ({
        ...connector,
        config: JSON.parse(JSON.stringify(connector.config)),
      }));

      const response: ApiResponse = {
        success: true,
        data: connectorsWithParsedConfig,
      };

      reply.send(response);
    } catch (error) {
      console.error('Error fetching connectors:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch connectors',
      });
    }
  });

  // Get connector by ID
  fastify.get('/connectors/:id', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = getUser(request);

      const connector = await prisma.tenantConnector.findUnique({
        where: { 
          id,
          tenantId: user.tenantId,
        },
      });

      if (!connector) {
        return reply.code(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Connector not found',
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          ...connector,
          config: JSON.parse(JSON.stringify(connector.config)),
        },
      };

      reply.send(response);
    } catch (error) {
      console.error('Error fetching connector:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch connector',
      });
    }
  });

  // Update connector
  fastify.put('/connectors/:id', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = getUser(request);
      const { name, config, status } = request.body as UpdateConnectorRequest;

      // Check if connector exists and belongs to user's tenant
      const existingConnector = await prisma.tenantConnector.findUnique({
        where: { 
          id,
          tenantId: user.tenantId,
        },
      });

      if (!existingConnector) {
        return reply.code(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Connector not found',
        });
      }

      // Validate configuration if provided
      if (config) {
        const validation = ConnectorService.validateConnectorConfig(existingConnector.connectorType, config);
        if (!validation.valid) {
          return reply.code(400).send({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid connector configuration',
            details: validation.errors,
          });
        }
      }

      const connector = await prisma.tenantConnector.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(config && { config }),
          ...(status && { status: status as any }),
          updatedAt: new Date(),
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...connector,
          config: JSON.parse(JSON.stringify(connector.config)),
        },
        message: 'Connector updated successfully',
      };

      reply.send(response);
    } catch (error) {
      console.error('Error updating connector:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update connector',
      });
    }
  });

  // Delete connector
  fastify.delete('/connectors/:id', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = getUser(request);

      // Check if connector exists and belongs to user's tenant
      const connector = await prisma.tenantConnector.findUnique({
        where: { 
          id,
          tenantId: user.tenantId,
        },
      });

      if (!connector) {
        return reply.code(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Connector not found',
        });
      }

      // Check if connector is being used by any jobs
      const activeJobs = await prisma.job.findMany({
        where: {
          OR: [
            { sourceConnectorId: id },
            { destinationConnectorId: id },
          ],
          status: { in: ['QUEUED', 'RUNNING'] },
        },
      });

      if (activeJobs.length > 0) {
        return reply.code(400).send({
          success: false,
          error: 'CONNECTOR_IN_USE',
          message: 'Cannot delete connector with active jobs',
        });
      }

      // Delete the connector directly without calling connector service methods
      // This allows deletion of legacy connectors (ServiceNow, Zendesk) that aren't implemented
      await prisma.tenantConnector.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Connector deleted successfully',
      };

      reply.send(response);
    } catch (error) {
      console.error('Error deleting connector:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete connector',
      });
    }
  });

  // Test connector connection - NOW WITH REAL IMPLEMENTATION
  fastify.post('/connectors/:id/test', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = getUser(request);

      // Get connector
      const connector = await prisma.tenantConnector.findUnique({
        where: { 
          id,
          tenantId: user.tenantId,
        },
      });

      if (!connector) {
        return reply.code(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Connector not found',
        });
      }

      // Check if connector type is supported in our new implementation
      const supportedTypes = ConnectorService.getConnectorTypes().map(t => t.type);
      if (!supportedTypes.includes(connector.connectorType)) {
        return reply.code(400).send({
          success: false,
          error: 'UNSUPPORTED_CONNECTOR',
          message: `Connector type ${connector.connectorType} is not supported in the current implementation. Only ${supportedTypes.join(', ')} are supported.`,
        });
      }

      // Test connection using real connector implementation
      const testResult = await ConnectorService.testConnection(id, user.tenantId);

      const response: ApiResponse<TestConnectorResponse> = {
        success: true,
        data: testResult,
      };

      reply.send(response);
    } catch (error) {
      console.error('Error testing connector:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to test connector',
      });
    }
  });

  // Get connector types and schemas - NOW WITH REAL METADATA
  fastify.get('/connectors/types', async (_request, reply) => {
    try {
      const connectorTypes = ConnectorService.getConnectorTypes();

      const response: ApiResponse = {
        success: true,
        data: connectorTypes,
      };

      reply.send(response);
    } catch (error) {
      console.error('Error fetching connector types:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch connector types',
      });
    }
  });

  // Get supported entities for a connector
  fastify.get('/connectors/:id/entities', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = getUser(request);

      // Get connector from database first
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: id,
          tenantId: user.tenantId
        }
      });

      if (!connector) {
        return reply.code(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Connector not found',
        });
      }

      // Check if connector type is supported
      const supportedTypes = ConnectorService.getConnectorTypes().map(t => t.type);
      if (!supportedTypes.includes(connector.connectorType)) {
        return reply.code(400).send({
          success: false,
          error: 'UNSUPPORTED_CONNECTOR',
          message: `Connector type ${connector.connectorType} is not supported in the current implementation. Only ${supportedTypes.join(', ')} are supported.`,
        });
      }

      const entities = await ConnectorService.getSupportedEntities(id, user.tenantId);

      const response: ApiResponse = {
        success: true,
        data: entities,
      };

      reply.send(response);
    } catch (error) {
      console.error('Error fetching supported entities:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch supported entities',
      });
    }
  });

  // Get entity schema for a connector
  fastify.get('/connectors/:id/entities/:entityType/schema', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, entityType } = request.params as { id: string; entityType: string };
      const user = getUser(request);

      // Get connector from database first
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: id,
          tenantId: user.tenantId
        }
      });

      if (!connector) {
        return reply.code(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: 'Connector not found',
        });
      }

      // Check if connector type is supported
      const supportedTypes = ConnectorService.getConnectorTypes().map(t => t.type);
      if (!supportedTypes.includes(connector.connectorType)) {
        return reply.code(400).send({
          success: false,
          error: 'UNSUPPORTED_CONNECTOR',
          message: `Connector type ${connector.connectorType} is not supported in the current implementation. Only ${supportedTypes.join(', ')} are supported.`,
        });
      }

      const schema = await ConnectorService.getEntitySchema(id, user.tenantId, entityType);

      const response: ApiResponse = {
        success: true,
        data: schema,
      };

      reply.send(response);
    } catch (error) {
      console.error('Error fetching entity schema:', error);
      reply.code(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch entity schema',
      });
    }
  });
} 