// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  API_PORT: z.string().transform(Number).default('3000'),
  API_HOST: z.string().default('localhost'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Bull Board
  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default('admin123'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
  }
};

export const config = parseEnv();

// Database configuration
export const dbConfig = {
  url: config.DATABASE_URL,
  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
};

// Redis configuration
export const redisConfig = {
  url: config.REDIS_URL,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

// JWT configuration
export const jwtConfig = {
  secret: config.JWT_SECRET,
  expiresIn: config.JWT_EXPIRES_IN,
  algorithm: 'HS256' as const,
};

// Server configuration
export const serverConfig = {
  port: config.API_PORT,
  host: config.API_HOST,
  logger: {
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
};

// Bull Board configuration
export const bullBoardConfig = {
  username: config.BULL_BOARD_USERNAME,
  password: config.BULL_BOARD_PASSWORD,
  path: '/admin/queues',
};

// Application configuration
export const appConfig = {
  env: config.NODE_ENV,
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  
  // CORS settings
  cors: {
    origin: config.NODE_ENV === 'development' 
      ? ['http://localhost:5173', 'http://localhost:3000']
      : true, // Configure for production domains
    credentials: true,
  },
  
  // Rate limiting
  rateLimit: {
    max: 100,
    timeWindow: '1 minute',
  },
  
  // File upload limits
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  },
};

// Export environment for type checking
export type Config = typeof config; 