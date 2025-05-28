import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationError } from '@/types';

// Define our user type
interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

/**
 * Authentication middleware - verifies JWT token and sets user context
 */
export const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    
    // Use Fastify's JWT verification
    const payload = request.server.jwt.verify(token) as any;
    
    // Set user on request with proper typing
    (request as any).user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};

// Alias for backward compatibility
export const authenticateUser = authenticate;

/**
 * Authorization middleware - checks user roles
 */
export const authorize = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser;
    
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(user.role)) {
      reply.code(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
      return;
    }
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = authorize(['ADMIN']);

/**
 * Tenant isolation middleware - ensures users can only access their tenant's data
 */
export const requireTenantAccess = (tenantId?: string) => {
  return async (request: FastifyRequest) => {
    const user = (request as any).user as AuthUser;
    
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    // Check if request includes tenant-specific data
    const requestTenantId = 
      tenantId ||
      (request.params as any)?.tenantId || 
      (request.body as any)?.tenantId ||
      (request.query as any)?.tenantId;

    if (requestTenantId && requestTenantId !== user.tenantId) {
      throw new AuthenticationError('Access denied to tenant resources');
    }

    return user;
  };
};

// Helper to get user from request
export const getUser = (request: FastifyRequest): AuthUser => {
  return (request as any).user as AuthUser;
};

/**
 * Optional authentication - sets user context if token is present but doesn't require it
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = request.server.jwt.verify(token) as any;

      (request as any).user = {
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