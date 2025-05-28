import { FastifyInstance } from 'fastify';
import { authService } from '@/services/auth.service';
import { authenticateUser, getUser } from '@/middleware/auth.middleware';
import { 
  LoginRequest, 
  ApiResponse, 
  ValidationError,
  AuthenticationError 
} from '@/types';

export async function authRoutes(fastify: FastifyInstance) {
  // Login endpoint
  fastify.post<{
    Body: LoginRequest;
  }>('/login', async (request, reply) => {
    try {
      const loginResult = await authService.login(request.body);
      
      // Sign the JWT token
      const token = fastify.jwt.sign(JSON.parse(loginResult.token));
      
      const response: ApiResponse = {
        success: true,
        data: {
          user: loginResult.user,
          token,
          expiresIn: loginResult.expiresIn,
        },
        message: 'Login successful',
      };

      return reply.status(200).send(response);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.name,
          message: error.message,
        });
      }

      fastify.log.error('Login error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }
  });

  // Get current user profile (protected route)
  fastify.get('/profile', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const userContext = getUser(request);
      const user = await authService.getUserById(userContext.userId);
      
      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Profile retrieved successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Profile error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve profile',
      });
    }
  });

  // Refresh token endpoint
  fastify.post('/refresh', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    try {
      const userContext = getUser(request);
      
      // Get fresh user data
      const user = await authService.getUserById(userContext.userId);
      
      // Create new token with fresh data
      const newToken = fastify.jwt.sign({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
      });

      const response: ApiResponse = {
        success: true,
        data: {
          token: newToken,
          expiresIn: '7d', // Use default from config
        },
        message: 'Token refreshed successfully',
      };

      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error('Token refresh error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to refresh token',
      });
    }
  });

  // Logout endpoint (client-side token removal)
  fastify.post('/logout', {
    preHandler: [authenticateUser],
  }, async (_request, reply) => {
    // Since we're using stateless JWT, logout is handled client-side
    // This endpoint exists for consistency and potential future token blacklisting
    
    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    return reply.status(200).send(response);
  });
} 