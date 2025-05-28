-- Initial database setup for Project Bridge
-- This file is executed when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for performance (will be created by Prisma migrations)
-- This file serves as documentation for manual setup if needed 