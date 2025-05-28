import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

const fastify = Fastify({
  logger: {
    level: 'info'
  }
});

// Register CORS
fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
});

// Register JWT
fastify.register(jwt, {
  secret: 'your-secret-key-here-change-in-production'
});

// Health check
fastify.get('/health', async (_request, _reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// Simple login endpoint for testing
fastify.post('/api/auth/login', async (request, reply) => {
  const { email, password } = request.body as any;
  
  // Simple test credentials
  if (email === 'admin@acme-corp.com' && password === 'admin123') {
    const token = fastify.jwt.sign({
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      role: 'ADMIN'
    });
    
    return {
      success: true,
      data: {
        user: {
          id: 'test-user-id',
          email: 'admin@acme-corp.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          tenantId: 'test-tenant-id'
        },
        token,
        expiresIn: '7d'
      },
      message: 'Login successful'
    };
  }
  
  return reply.code(401).send({
    success: false,
    error: 'AUTHENTICATION_ERROR',
    message: 'Invalid credentials'
  });
});

// Simple API info endpoint
fastify.get('/api', async (_request, _reply) => {
  return {
    name: 'Project Bridge API',
    version: '1.0.0',
    description: 'B2B SaaS platform for migrating data between helpdesk systems',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Simple server running on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 