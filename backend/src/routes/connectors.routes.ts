import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate, getUser } from '@/middleware/auth.middleware';
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

      // Create connector
      const connector = await prisma.tenantConnector.create({
        data: {
          tenantId: user.tenantId,
          name,
          connectorType: connectorType as any,
          config,
          status: 'ACTIVE',
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

  // Test connector connection
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

      // Test connection (mock implementation)
      const testResult = await testConnectorConnection(connector);

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

  // Get connector types and schemas
  fastify.get('/connectors/types', async (_request, reply) => {
    try {
      const connectorTypes = {
        FRESHSERVICE: {
          name: 'FreshService',
          description: 'FreshService helpdesk system',
          configSchema: {
            domain: { type: 'string', required: true, description: 'FreshService domain' },
            apiKey: { type: 'string', required: true, description: 'API key' },
          },
        },
        SERVICENOW: {
          name: 'ServiceNow',
          description: 'ServiceNow platform',
          configSchema: {
            instance: { type: 'string', required: true, description: 'ServiceNow instance URL' },
            username: { type: 'string', required: true, description: 'Username' },
            password: { type: 'string', required: true, description: 'Password' },
          },
        },
        ZENDESK: {
          name: 'Zendesk',
          description: 'Zendesk support platform',
          configSchema: {
            subdomain: { type: 'string', required: true, description: 'Zendesk subdomain' },
            email: { type: 'string', required: true, description: 'Admin email' },
            token: { type: 'string', required: true, description: 'API token' },
          },
        },
      };

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
}

/**
 * Test connector connection (mock implementation)
 */
async function testConnectorConnection(_connector: any): Promise<TestConnectorResponse> {
  // Mock connection test
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    success: true,
    message: 'Connection successful',
    details: {
      version: '1.0.0',
      endpoints: ['tickets', 'users', 'assets'],
      permissions: ['read', 'write'],
    },
  };
} 