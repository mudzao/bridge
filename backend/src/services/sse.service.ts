import { FastifyReply } from 'fastify';
import IORedis from 'ioredis';
import { redisConfig } from '@/config';

export interface SSEClient {
  id: string;
  jobId: string;
  tenantId: string;
  reply: FastifyReply;
  lastPing: number;
}

export interface ProgressEvent {
  jobId: string;
  tenantId: string;
  type: 'progress' | 'status' | 'error' | 'complete';
  data: {
    progress?: number;
    status?: string;
    message?: string;
    phase?: string;
    recordsProcessed?: number;
    totalRecords?: number;
    currentEntity?: string;
    error?: string;
    estimatedCompletion?: string;
  };
  timestamp: string;
}

export class SSEService {
  private static instance: SSEService;
  private clients: Map<string, SSEClient> = new Map();
  private redis: IORedis;
  private subscriber: IORedis;

  constructor() {
    this.redis = new IORedis(redisConfig.url);
    this.subscriber = new IORedis(redisConfig.url);
    this.setupProgressSubscription();
    this.startHeartbeat();
  }

  static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  /**
   * Add a new SSE client for job progress updates
   */
  addClient(clientId: string, jobId: string, tenantId: string, reply: FastifyReply): void {
    console.log(`Adding SSE client ${clientId} for job ${jobId}`);

    // Setup SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Store client
    this.clients.set(clientId, {
      id: clientId,
      jobId,
      tenantId,
      reply,
      lastPing: Date.now(),
    });

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connection',
      data: { message: 'Connected to job progress stream' }
    });

    // Handle client disconnect
    reply.raw.on('close', () => {
      console.log(`SSE client ${clientId} disconnected`);
      this.removeClient(clientId);
    });

    reply.raw.on('error', (error) => {
      console.error(`SSE client ${clientId} error:`, error);
      this.removeClient(clientId);
    });
  }

  /**
   * Remove SSE client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.reply.raw.end();
      } catch (error) {
        console.error('Error closing SSE client:', error);
      }
      this.clients.delete(clientId);
      console.log(`Removed SSE client ${clientId}`);
    }
  }

  /**
   * Broadcast progress event to job-specific clients
   */
  async broadcastProgress(event: ProgressEvent): Promise<void> {
    console.log(`Broadcasting progress for job ${event.jobId}:`, event);

    // Publish to Redis for multi-instance support
    await this.redis.publish('job-progress', JSON.stringify(event));
  }

  /**
   * Send event to specific client
   */
  private sendToClient(clientId: string, event: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      client.reply.raw.write(eventData);
      client.lastPing = Date.now();
    } catch (error) {
      console.error(`Error sending to SSE client ${clientId}:`, error);
      this.removeClient(clientId);
    }
  }

  /**
   * Setup Redis subscription for progress events
   */
  private setupProgressSubscription(): void {
    this.subscriber.subscribe('job-progress');
    
    this.subscriber.on('message', (channel, message) => {
      if (channel === 'job-progress') {
        try {
          const event: ProgressEvent = JSON.parse(message);
          this.handleProgressEvent(event);
        } catch (error) {
          console.error('Error parsing progress event:', error);
        }
      }
    });
  }

  /**
   * Handle incoming progress events and send to relevant clients
   */
  private handleProgressEvent(event: ProgressEvent): void {
    // Send to all clients listening to this job
    this.clients.forEach((client) => {
      if (client.jobId === event.jobId && client.tenantId === event.tenantId) {
        this.sendToClient(client.id, {
          type: event.type,
          data: event.data,
          timestamp: event.timestamp,
        });
      }
    });
  }

  /**
   * Start heartbeat to keep connections alive and clean up dead ones
   */
  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      const deadClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        // Check if client is stale (no activity for 30 seconds)
        if (now - client.lastPing > 30000) {
          deadClients.push(clientId);
        } else {
          // Send heartbeat
          this.sendToClient(clientId, {
            type: 'heartbeat',
            data: { timestamp: new Date().toISOString() }
          });
        }
      });

      // Remove dead clients
      deadClients.forEach(clientId => this.removeClient(clientId));
    }, 10000); // Every 10 seconds
  }

  /**
   * Get current client count for monitoring
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients for specific job
   */
  getJobClients(jobId: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(client => client.jobId === jobId);
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.log('Closing SSE service...');
    
    // Close all client connections
    this.clients.forEach((client, clientId) => {
      this.removeClient(clientId);
    });

    // Close Redis connections
    await this.subscriber.disconnect();
    await this.redis.disconnect();
  }
} 