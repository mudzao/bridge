import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { FastifyInstance } from 'fastify';
import { queueService } from './queue.service';
import { bullBoardConfig } from '@/config';

export class BullBoardService {
  private serverAdapter: FastifyAdapter;

  constructor() {
    this.serverAdapter = new FastifyAdapter();
  }

  /**
   * Setup Bull Board dashboard
   */
  setupDashboard() {
    // Get all queues from queue service
    const queues = queueService.getQueues();
    
    // Create Bull Board with queue adapters
    createBullBoard({
      queues: queues.map(queue => new BullMQAdapter(queue)),
      serverAdapter: this.serverAdapter,
    });

    // Set the base path for the dashboard
    this.serverAdapter.setBasePath(bullBoardConfig.path);

    return this.serverAdapter;
  }

  /**
   * Register Bull Board routes with Fastify
   */
  async registerRoutes(fastify: FastifyInstance) {
    // Setup the dashboard
    const serverAdapter = this.setupDashboard();

    // Basic authentication for Bull Board
    await fastify.register(async function (fastify) {
      // Add basic auth middleware for Bull Board routes
      fastify.addHook('preHandler', async (request, reply) => {
        const authHeader = request.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          reply.header('WWW-Authenticate', 'Basic realm="Bull Board"');
          return reply.status(401).send('Authentication required');
        }

        const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
        const [username, password] = credentials.split(':');

        if (username !== bullBoardConfig.username || password !== bullBoardConfig.password) {
          return reply.status(401).send('Invalid credentials');
        }
      });

      // Register Bull Board routes
      await fastify.register(serverAdapter.registerPlugin(), {
        prefix: bullBoardConfig.path,
        basePath: bullBoardConfig.path,
      });
    });
  }

  /**
   * Get dashboard URL
   */
  getDashboardUrl(baseUrl: string): string {
    return `${baseUrl}${bullBoardConfig.path}`;
  }

  /**
   * Get queue statistics for API endpoints
   */
  async getQueueStats() {
    return await queueService.getQueueStats();
  }
}

export const bullBoardService = new BullBoardService(); 