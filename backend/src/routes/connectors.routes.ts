import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, requireTenantAccess } from '@/middleware/auth.middleware';
import { 
  CreateConnectorRequest, 
  UpdateConnectorRequest,
  ApiResponse, 
  ValidationError,
  NotFoundError 
} from '@/types';

const prisma = new PrismaClient();

export async function connectorRoutes(fastify: FastifyInstance) {
  // Create a new connector
  fastify.post<{
    Body: CreateConnectorRequest;
  }>('/connectors', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { name, type, configuration, description } = request.body;
      const { tenantId } = request.user!;

      // Validate connector type
      const validTypes = ['SERVICENOW', 'FRESHSERVICE', 'ZENDESK'];
      if (!validTypes.includes(type)) {
        throw new ValidationError('Invalid connector type');
      }

      // Create connector
      const connector = await prisma.connector.create({
        data: {
          name,
          type,
          configuration: JSON.stringify(configuration),
          description,
          tenantId,
          isActive: true,
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...connector,
          configuration: JSON.parse(connector.configuration),
        },
        message: 'Connector created successfully',
      };

      return reply.status(201).send(response);
    } catch (error) {
      if (error instanceof ValidationError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Create connector error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create connector',
      });
    }
  });

  // Get all connectors for tenant
  fastify.get('/connectors', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const { tenantId } = request.user!;

      const connectors = await prisma.connector.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      // Parse configuration JSON for each connector
      const connectorsWithParsedConfig = connectors.map(connector => ({
        ...connector,
        configuration: JSON.parse(connector.configuration),
      }));

      const response: ApiResponse = {
        success: true,
        data: connectorsWithParsedConfig,
        message: 'Connectors retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Get connectors error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve connectors',
      });
    }
  });

  // Get specific connector by ID
  fastify.get<{
    Params: { connectorId: string };
  }>('/connectors/:connectorId', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { connectorId } = request.params;
      const { tenantId } = request.user!;

      const connector = await prisma.connector.findUnique({
        where: { id: connectorId, tenantId },
      });

      if (!connector) {
        throw new NotFoundError('Connector not found');
      }

      const response: ApiResponse = {
        success: true,
        data: {
          ...connector,
          configuration: JSON.parse(connector.configuration),
        },
        message: 'Connector retrieved successfully',
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

      fastify.log.error('Get connector error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve connector',
      });
    }
  });

  // Update connector
  fastify.put<{
    Params: { connectorId: string };
    Body: UpdateConnectorRequest;
  }>('/connectors/:connectorId', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { connectorId } = request.params;
      const { tenantId } = request.user!;
      const { name, configuration, description, isActive } = request.body;

      // Verify connector exists and belongs to tenant
      const existingConnector = await prisma.connector.findUnique({
        where: { id: connectorId, tenantId },
      });

      if (!existingConnector) {
        throw new NotFoundError('Connector not found');
      }

      // Update connector
      const connector = await prisma.connector.update({
        where: { id: connectorId },
        data: {
          ...(name && { name }),
          ...(configuration && { configuration: JSON.stringify(configuration) }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...connector,
          configuration: JSON.parse(connector.configuration),
        },
        message: 'Connector updated successfully',
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

      fastify.log.error('Update connector error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update connector',
      });
    }
  });

  // Delete connector
  fastify.delete<{
    Params: { connectorId: string };
  }>('/connectors/:connectorId', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { connectorId } = request.params;
      const { tenantId } = request.user!;

      // Verify connector exists and belongs to tenant
      const connector = await prisma.connector.findUnique({
        where: { id: connectorId, tenantId },
      });

      if (!connector) {
        throw new NotFoundError('Connector not found');
      }

      // Check if connector is used in any jobs
      const jobsUsingConnector = await prisma.job.count({
        where: {
          OR: [
            { sourceConnectorId: connectorId },
            { targetConnectorId: connectorId },
          ],
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      if (jobsUsingConnector > 0) {
        throw new ValidationError('Cannot delete connector with active jobs');
      }

      // Delete connector
      await prisma.connector.delete({
        where: { id: connectorId },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Connector deleted successfully',
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

      fastify.log.error('Delete connector error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete connector',
      });
    }
  });

  // Test connector connection
  fastify.post<{
    Params: { connectorId: string };
  }>('/connectors/:connectorId/test', {
    preHandler: [authenticateUser, requireTenantAccess()],
  }, async (request, reply) => {
    try {
      const { connectorId } = request.params;
      const { tenantId } = request.user!;

      // Get connector
      const connector = await prisma.connector.findUnique({
        where: { id: connectorId, tenantId },
      });

      if (!connector) {
        throw new NotFoundError('Connector not found');
      }

      // Mock connection test - replace with actual connector testing
      const testResult = await this.testConnectorConnection(connector);

      const response: ApiResponse = {
        success: true,
        data: testResult,
        message: 'Connector test completed',
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

      fastify.log.error('Test connector error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to test connector',
      });
    }
  });

  // Get connector types and their configuration schemas
  fastify.get('/connectors/types', async (request, reply) => {
    try {
      const connectorTypes = [
        {
          type: 'SERVICENOW',
          name: 'ServiceNow',
          description: 'ServiceNow IT Service Management platform',
          configurationSchema: {
            instanceUrl: { type: 'string', required: true, description: 'ServiceNow instance URL' },
            username: { type: 'string', required: true, description: 'Username for authentication' },
            password: { type: 'string', required: true, description: 'Password for authentication' },
            apiVersion: { type: 'string', required: false, description: 'API version (default: v1)' },
          },
        },
        {
          type: 'FRESHSERVICE',
          name: 'Freshservice',
          description: 'Freshservice IT Service Management platform',
          configurationSchema: {
            domain: { type: 'string', required: true, description: 'Freshservice domain' },
            apiKey: { type: 'string', required: true, description: 'API key for authentication' },
            apiVersion: { type: 'string', required: false, description: 'API version (default: v2)' },
          },
        },
        {
          type: 'ZENDESK',
          name: 'Zendesk',
          description: 'Zendesk customer service platform',
          configurationSchema: {
            subdomain: { type: 'string', required: true, description: 'Zendesk subdomain' },
            email: { type: 'string', required: true, description: 'Email for authentication' },
            token: { type: 'string', required: true, description: 'API token' },
          },
        },
      ];

      const response: ApiResponse = {
        success: true,
        data: connectorTypes,
        message: 'Connector types retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Get connector types error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve connector types',
      });
    }
  });
}

/**
 * Mock connector connection test - replace with actual implementations
 */
async function testConnectorConnection(connector: any): Promise<any> {
  const config = JSON.parse(connector.configuration);
  
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock success with some random failures
  const isSuccess = Math.random() > 0.2; // 80% success rate
  
  return {
    success: isSuccess,
    message: isSuccess ? 'Connection successful' : 'Connection failed: Invalid credentials',
    timestamp: new Date().toISOString(),
    responseTime: Math.floor(Math.random() * 1000) + 100, // 100-1100ms
  };
} 