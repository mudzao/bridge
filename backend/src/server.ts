import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { serverConfig, jwtConfig, appConfig } from '@/config';
import { authRoutes } from '@/routes/auth.routes';
import { jobRoutes } from '@/routes/jobs.routes';
import { connectorRoutes } from '@/routes/connectors.routes';
import { exportRoutes } from '@/routes/export.routes';
import { bullBoardService } from '@/services/bullboard.service';

// Create Fastify instance with simplified logger
const fastify = Fastify({
  logger: appConfig.isDevelopment ? {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  } : { level: 'info' },
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
  // Root route - API information and frontend redirect
  fastify.get('/', async (_request, _reply) => {
    return {
      name: 'Project Bridge API',
      version: '1.0.0',
      description: 'B2B SaaS platform for migrating data between helpdesk systems',
      message: 'This is the API server. For the web application, visit: http://localhost:5173',
      endpoints: {
        frontend: 'http://localhost:5173',
        health: '/health',
        api: '/api',
        auth: '/api/auth',
        jobs: '/api/jobs',
        connectors: '/api/connectors',
        dashboard: '/admin/queues',
      },
      documentation: {
        login: 'POST /api/auth/login',
        sampleCredentials: {
          email: 'admin@acme-corp.com',
          password: 'admin123'
        }
      }
    };
  });

  // Health check
  fastify.get('/health', async (_request, _reply) => {
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
  await fastify.register(exportRoutes, { prefix: '/api' });

  // Bull Board dashboard - skip for now to avoid type issues
  try {
    await bullBoardService.registerRoutes(fastify as any);
  } catch (error) {
    fastify.log.warn('Bull Board registration failed:', error);
  }

  // Basic API info
  fastify.get('/api', async (_request, _reply) => {
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
fastify.setErrorHandler((error, _request, reply) => {
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
    
    // Note: Workers run separately and should be stopped independently
    
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
    
    // Note: Workers run separately via `npm run worker:dev`
    fastify.log.info(`📋 Server started successfully - workers should be started separately`);
    fastify.log.info(`💡 To start workers: npm run worker:dev`);
  } catch (error) {
    fastify.log.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
start(); 