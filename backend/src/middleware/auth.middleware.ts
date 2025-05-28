import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '@/services/auth.service';
import { AuthenticationError, AuthorizationError } from '@/types';

// Extend FastifyRequest to include user context
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      tenantId: string;
      role: string;
    };
  }
}

/**
 * Authentication middleware - verifies JWT token and sets user context
 */
export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Authorization token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token using Fastify JWT
    const decoded = request.server.jwt.verify(token);
    
    // Validate payload structure
    const payload = authService.validateJwtPayload(decoded);

    // Set user context on request
    request.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    };

  } catch (error) {
    if (error instanceof AuthenticationError) {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: error.message,
        statusCode: 401,
      });
    }

    // JWT verification errors
    return reply.status(401).send({
      error: 'Authentication Error',
      message: 'Invalid or expired token',
      statusCode: 401,
    });
  }
}

/**
 * Authorization middleware - checks user roles
 */
export function requireRole(allowedRoles: string[]) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: 'User context not found',
        statusCode: 401,
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: 'Authorization Error',
        message: 'Insufficient permissions',
        statusCode: 403,
      });
    }
  };
}

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole(['ADMIN']);

/**
 * Tenant isolation middleware - ensures users can only access their tenant's data
 */
export function requireTenantAccess(tenantIdParam: string = 'tenantId') {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: 'User context not found',
        statusCode: 401,
      });
    }

    // Get tenant ID from request params or body
    const requestTenantId = (request.params as any)[tenantIdParam] || 
                           (request.body as any)?.[tenantIdParam];

    // If tenant ID is specified in request, verify it matches user's tenant
    if (requestTenantId && requestTenantId !== request.user.tenantId) {
      return reply.status(403).send({
        error: 'Authorization Error',
        message: 'Access denied to this tenant',
        statusCode: 403,
      });
    }
  };
}

/**
 * Optional authentication - sets user context if token is present but doesn't require it
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = request.server.jwt.verify(token);
      const payload = authService.validateJwtPayload(decoded);

      request.user = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        role: payload.role,
      };
    }
  } catch (error) {
    // Silently ignore authentication errors for optional auth
    // User context will remain undefined
  }
} 