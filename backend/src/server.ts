import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { serverConfig, jwtConfig, appConfig } from '@/config';
import { authRoutes } from '@/routes/auth.routes';
import { jobRoutes } from '@/routes/jobs.routes';
import { connectorRoutes } from '@/routes/connectors.routes';
import { bullBoardService } from '@/services/bullboard.service';

// Create Fastify instance
const fastify = Fastify({
  logger: serverConfig.logger,
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, appConfig.cors);

  // JWT
  await fastify.register(jwt, {
    secret: jwtConfig.secret,
  });

  // Multipart for file uploads
  await fastify.register(multipart, appConfig.upload);
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: appConfig.env,
    };
  });

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(jobRoutes, { prefix: '/api' });
  await fastify.register(connectorRoutes, { prefix: '/api' });

  // Bull Board dashboard
  await bullBoardService.registerRoutes(fastify);

  // Basic API info
  fastify.get('/api', async (request, reply) => {
    return {
      name: 'Project Bridge API',
      version: '1.0.0',
      description: 'B2B SaaS platform for migrating data between helpdesk systems',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        jobs: '/api/jobs',
        connectors: '/api/connectors',
        dashboard: bullBoardService.getDashboardUrl(`http://${serverConfig.host}:${serverConfig.port}`),
      },
    };
  });
}

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  // JWT errors
  if (error.code === 'FST_JWT_BAD_REQUEST' || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      success: false,
      error: 'Authentication Error',
      message: 'Invalid or missing token',
    });
  }

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.validation,
    });
  }

  // Default error response
  return reply.status(500).send({
    success: false,
    error: 'Internal Server Error',
    message: appConfig.isDevelopment ? error.message : 'An unexpected error occurred',
  });
});

// Graceful shutdown
async function gracefulShutdown() {
  try {
    fastify.log.info('Starting graceful shutdown...');
    
    // Close Fastify server
    await fastify.close();
    
    // Close queue service
    const { queueService } = await import('@/services/queue.service');
    await queueService.close();
    
    fastify.log.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    fastify.log.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function start() {
  try {
    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();

    // Start listening
    await fastify.listen({
      port: serverConfig.port,
      host: serverConfig.host,
    });

    fastify.log.info(`🚀 Server running at http://${serverConfig.host}:${serverConfig.port}`);
    fastify.log.info(`📊 Bull Board dashboard: ${bullBoardService.getDashboardUrl(`http://${serverConfig.host}:${serverConfig.port}`)}`);
    fastify.log.info(`🔧 Environment: ${appConfig.env}`);
  } catch (error) {
    fastify.log.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
start(); 