import IORedis from 'ioredis';
import { redisConfig } from '@/config';

interface RateLimitConfig {
  requestsPerMinute: number;
  burstSize: number;
  windowSizeMs: number;
  retryAfterMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfterMs?: number;
}

interface ConnectorLimits {
  [key: string]: RateLimitConfig;
}

export class RateLimiterService {
  private static instance: RateLimiterService;
  private redis: IORedis;

  // Rate limit configurations for each connector type
  private readonly RATE_LIMITS: ConnectorLimits = {
    FRESHSERVICE: {
      requestsPerMinute: 60,    // Reduced from 120 to match actual API limits
      burstSize: 10,            // Reduced from 15
      windowSizeMs: 60000,      // 1 minute window
      retryAfterMs: 5000,       // Reduced from 15000 for faster retries
    },
    SERVICENOW: {
      requestsPerMinute: 40,    // Very conservative for ServiceNow
      burstSize: 5,
      windowSizeMs: 60000,
      retryAfterMs: 30000,      // 30 second default retry
    },
    ZENDESK: {
      requestsPerMinute: 60,    // Zendesk is generally more lenient
      burstSize: 8,
      windowSizeMs: 60000,
      retryAfterMs: 20000,      // 20 second default retry
    },
  };

  constructor() {
    this.redis = new IORedis(redisConfig.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  public static getInstance(): RateLimiterService {
    if (!RateLimiterService.instance) {
      RateLimiterService.instance = new RateLimiterService();
    }
    return RateLimiterService.instance;
  }

  /**
   * Check if API call is allowed for a specific connector
   * @param connectorId - Unique connector ID (per tenant)
   * @param connectorType - Type of connector (FRESHSERVICE, SERVICENOW, etc.)
   * @param requestCount - Number of requests to reserve (default: 1)
   */
  async checkRateLimit(
    connectorId: string, 
    connectorType: string, 
    requestCount: number = 1
  ): Promise<RateLimitResult> {
    const config = this.RATE_LIMITS[connectorType];
    if (!config) {
      // Unknown connector type - allow but log warning
      console.warn(`Unknown connector type for rate limiting: ${connectorType}`);
      return {
        allowed: true,
        remainingRequests: 999,
        resetTime: Date.now() + 60000,
      };
    }

    const key = `rate_limit:${connectorType}:${connectorId}`;
    const now = Date.now();
    const windowStart = now - config.windowSizeMs;

    try {
      // Use Redis sliding window counter
      const pipeline = this.redis.pipeline();
      
      // Remove old requests outside window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      const results = await pipeline.exec();
      
      // Handle null results case
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }
      
      const currentCount = (results[1]?.[1] as number) || 0;
      
      // Check if request is allowed BEFORE adding to Redis
      const allowed = (currentCount + requestCount) <= config.requestsPerMinute;
      
      if (allowed) {
        // Only add requests if they're allowed
        const addPipeline = this.redis.pipeline();
        for (let i = 0; i < requestCount; i++) {
          addPipeline.zadd(key, now + i, `${now}-${i}-${Math.random()}`);
        }
        // Set expiry
        addPipeline.expire(key, Math.ceil(config.windowSizeMs / 1000));
        await addPipeline.exec();
      }

      const result: RateLimitResult = {
        allowed,
        remainingRequests: Math.max(0, config.requestsPerMinute - currentCount - (allowed ? requestCount : 0)),
        resetTime: now + config.windowSizeMs,
      };

      if (!allowed) {
        result.retryAfterMs = config.retryAfterMs;
      }

      return result;
      
    } catch (error) {
      console.error('Rate limiting check failed:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remainingRequests: 999,
        resetTime: now + 60000,
      };
    }
  }

  /**
   * Wait for rate limit to reset with exponential backoff
   */
  async waitForRateLimit(connectorId: string, connectorType: string, retryAfterMs?: number): Promise<void> {
    const config = this.RATE_LIMITS[connectorType];
    const waitTime = retryAfterMs || config?.retryAfterMs || 30000;
    
    console.log(`Rate limit hit for ${connectorType}:${connectorId}, waiting ${waitTime}ms`);
    
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Record a 429 error and adjust future rate limiting
   */
  async record429Error(
    connectorId: string, 
    connectorType: string, 
    retryAfterHeader?: string
  ): Promise<void> {
    const key = `rate_limit_429:${connectorType}:${connectorId}`;
    const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader) * 1000 : undefined;
    
    await this.redis.setex(key, 300, JSON.stringify({
      timestamp: Date.now(),
      retryAfterMs,
      count: await this.redis.incr(`${key}:count`),
    }));
    
    // Set expiry on counter
    await this.redis.expire(`${key}:count`, 300);
    
    console.warn(`429 error recorded for ${connectorType}:${connectorId}, retry after: ${retryAfterMs}ms`);
  }

  /**
   * Get current rate limit status for monitoring
   */
  async getRateLimitStatus(connectorId: string, connectorType: string) {
    const key = `rate_limit:${connectorType}:${connectorId}`;
    const config = this.RATE_LIMITS[connectorType];
    
    if (!config) return null;
    
    const now = Date.now();
    const windowStart = now - config.windowSizeMs;
    
    const currentCount = await this.redis.zcount(key, windowStart, now);
    
    return {
      connectorId,
      connectorType,
      currentRequests: currentCount,
      maxRequests: config.requestsPerMinute,
      remainingRequests: Math.max(0, config.requestsPerMinute - currentCount),
      windowSizeMs: config.windowSizeMs,
      resetTime: now + config.windowSizeMs,
    };
  }

  /**
   * Get rate limit statistics for all active connectors
   */
  async getAllRateLimitStats() {
    const pattern = 'rate_limit:*';
    const keys = await this.redis.keys(pattern);
    
    const stats = [];
    for (const key of keys) {
      const parts = key.split(':');
      const connectorType = parts[1];
      const connectorId = parts[2];
      
      // Skip if we don't have both parts
      if (!connectorType || !connectorId) {
        continue;
      }
      
      const status = await this.getRateLimitStatus(connectorId, connectorType);
      if (status) {
        stats.push(status);
      }
    }
    
    return stats;
  }

  /**
   * Clean up old rate limit data
   */
  async cleanup() {
    const pattern = 'rate_limit:*';
    const keys = await this.redis.keys(pattern);
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // Key has no expiry, set one
        await this.redis.expire(key, 3600); // 1 hour
      }
    }
  }

  async close() {
    await this.redis.disconnect();
  }
}

export const rateLimiterService = RateLimiterService.getInstance(); 