import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { redisConfig } from '@/config';
import { QUEUE_NAMES, JOB_TYPES } from '@/services/queue.service';
import { JobStatus } from '@/types';

const prisma = new PrismaClient();

// Redis connection for workers
const redisConnection = new IORedis(redisConfig.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

export class MigrationWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(QUEUE_NAMES.MIGRATION, this.processJob.bind(this), {
      connection: redisConnection,
      concurrency: 2,
    });

    this.setupEventHandlers();
  }

  /**
   * Process migration jobs
   */
  private async processJob(job: Job): Promise<any> {
    const { jobId } = job.data;

    try {
      console.log(`Processing migration job ${jobId}`);

      // Determine job type and process accordingly
      const jobType = job.data.type || JOB_TYPES.EXTRACT_DATA;

      switch (jobType) {
        case JOB_TYPES.EXTRACT_DATA:
          return await this.extractData(job);
        case JOB_TYPES.TRANSFORM_DATA:
          return await this.transformData(job);
        case JOB_TYPES.LOAD_DATA:
          return await this.loadData(job);
        case JOB_TYPES.CLEANUP_DATA:
          return await this.cleanupData(job);
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.updateJobStatus(jobId, JobStatus.FAILED, `Job failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Extract data from source system
   */
  private async extractData(job: Job): Promise<any> {
    const { jobId, sourceConnectorId, tenantId } = job.data;

    // Update progress
    await job.updateProgress(10);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Starting data extraction');

    // Get source connector configuration
    const sourceConnector = await prisma.tenantConnector.findUnique({
      where: { id: sourceConnectorId, tenantId },
    });

    if (!sourceConnector) {
      throw new Error('Source connector not found');
    }

    // Simulate data extraction process
    await job.updateProgress(30);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Connecting to source system');

    // Mock extraction logic - replace with actual connector implementations
    const extractedData = await this.mockDataExtraction(sourceConnector, job);

    await job.updateProgress(70);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Data extraction completed');

    // Store extracted data
    await this.storeExtractedData(jobId, extractedData);

    await job.updateProgress(100);
    await this.updateJobStatus(jobId, JobStatus.COMPLETED, 'Data extraction successful');

    // Queue transformation job
    await this.queueNextJob(job, JOB_TYPES.TRANSFORM_DATA);

    return { extractedRecords: extractedData.length };
  }

  /**
   * Transform extracted data
   */
  private async transformData(job: Job): Promise<any> {
    const { jobId, targetConnectorId, tenantId } = job.data;

    await job.updateProgress(10);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Starting data transformation');

    // Get target connector configuration
    const targetConnector = await prisma.tenantConnector.findUnique({
      where: { id: targetConnectorId, tenantId },
    });

    if (!targetConnector) {
      throw new Error('Target connector not found');
    }

    // Get extracted data
    const extractedData = await this.getExtractedData(jobId);

    await job.updateProgress(30);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Transforming data format');

    // Mock transformation logic
    const transformedData = await this.mockDataTransformation(extractedData, targetConnector, job);

    await job.updateProgress(80);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Storing transformed data');

    // Store transformed data
    await this.storeTransformedData(jobId, transformedData);

    await job.updateProgress(100);
    await this.updateJobStatus(jobId, JobStatus.COMPLETED, 'Data transformation successful');

    // Queue loading job
    await this.queueNextJob(job, JOB_TYPES.LOAD_DATA);

    return { transformedRecords: transformedData.length };
  }

  /**
   * Load data into target system
   */
  private async loadData(job: Job): Promise<any> {
    const { jobId, targetConnectorId, tenantId } = job.data;

    await job.updateProgress(10);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Starting data loading');

    // Get target connector
    const targetConnector = await prisma.tenantConnector.findUnique({
      where: { id: targetConnectorId, tenantId },
    });

    if (!targetConnector) {
      throw new Error('Target connector not found');
    }

    // Get transformed data
    const transformedData = await this.getTransformedData(jobId);

    await job.updateProgress(30);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Loading data to target system');

    // Mock loading logic
    const loadResults = await this.mockDataLoading(transformedData, targetConnector, job);

    await job.updateProgress(90);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Finalizing migration');

    // Store loading results
    await this.storeLoadingResults(jobId, loadResults);

    await job.updateProgress(100);
    await this.updateJobStatus(jobId, JobStatus.COMPLETED, 'Migration completed successfully');

    return { loadedRecords: loadResults.successCount, errors: loadResults.errorCount };
  }

  /**
   * Clean up temporary data
   */
  private async cleanupData(job: Job): Promise<any> {
    const { tenantId } = job.data;

    // Clean up old extracted data (older than 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const deletedCount = await prisma.jobExtractedData.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: cutoffDate },
      },
    });

    return { deletedRecords: deletedCount.count };
  }

  /**
   * Mock data extraction - replace with actual connector implementations
   */
  private async mockDataExtraction(_connector: any, job: Job): Promise<any[]> {
    // Simulate API calls and data extraction
    const mockData = [];
    const totalRecords = 100; // Mock total

    for (let i = 0; i < totalRecords; i++) {
      mockData.push({
        id: `record_${i}`,
        title: `Sample Record ${i}`,
        description: `Description for record ${i}`,
        status: 'open',
        createdAt: new Date(),
      });

      // Update progress periodically
      if (i % 10 === 0) {
        const progress = 30 + (i / totalRecords) * 40; // 30-70% range
        await job.updateProgress(progress);
      }
    }

    return mockData;
  }

  /**
   * Mock data transformation
   */
  private async mockDataTransformation(data: any[], targetConnector: any, job: Job): Promise<any[]> {
    const transformedData = [];

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      // Mock transformation logic
      transformedData.push({
        ...record,
        targetId: `target_${record.id}`,
        transformedAt: new Date(),
        targetFormat: targetConnector.type,
      });

      // Update progress
      if (i % 10 === 0) {
        const progress = 30 + (i / data.length) * 50; // 30-80% range
        await job.updateProgress(progress);
      }
    }

    return transformedData;
  }

  /**
   * Mock data loading
   */
  private async mockDataLoading(data: any[], _targetConnector: any, job: Job): Promise<any> {
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      // Mock loading with some failures
      if (Math.random() > 0.1) { // 90% success rate
        successCount++;
      } else {
        errorCount++;
      }

      // Update progress
      if (i % 10 === 0) {
        const progress = 30 + (i / data.length) * 60; // 30-90% range
        await job.updateProgress(progress);
      }
    }

    return { successCount, errorCount, totalRecords: data.length };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(jobId: string, status: JobStatus, message: string) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        error: status === JobStatus.FAILED ? message : null,
        completedAt: status === JobStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  /**
   * Store extracted data in database
   */
  private async storeExtractedData(jobId: string, data: any[]) {
    await prisma.jobExtractedData.create({
      data: {
        jobId,
        tenantId: 'temp-tenant-id', // TODO: Get from job context
        entityType: 'tickets',
        batchNumber: 1,
        sourceSystem: 'mock',
        rawData: data,
        transformedData: data,
        recordCount: data.length,
        extractionTimestamp: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  /**
   * Get extracted data from database
   */
  private async getExtractedData(jobId: string): Promise<any[]> {
    const extracted = await prisma.jobExtractedData.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return extracted?.rawData as any[] || [];
  }

  /**
   * Store transformed data
   */
  private async storeTransformedData(jobId: string, data: any[]) {
    await prisma.jobExtractedData.updateMany({
      where: { jobId },
      data: {
        transformedData: data,
      },
    });
  }

  /**
   * Get transformed data
   */
  private async getTransformedData(jobId: string): Promise<any[]> {
    const extracted = await prisma.jobExtractedData.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return extracted?.transformedData as any[] || [];
  }

  /**
   * Store loading results
   */
  private async storeLoadingResults(_jobId: string, results: any) {
    await prisma.jobLoadResult.create({
      data: {
        jobExtractedDataId: 'temp-id', // TODO: Get actual extracted data ID
        destinationSystem: 'mock',
        successCount: results.successCount,
        failedCount: results.errorCount,
        errorDetails: results.errors || {},
        loadedAt: new Date(),
      },
    });
  }

  /**
   * Queue next job in the pipeline
   */
  private async queueNextJob(currentJob: Job, nextJobType: string) {
    // This would integrate with the queue service to add the next job
    // For now, we'll just log it
    console.log(`Queueing next job: ${nextJobType} for job ${currentJob.data.jobId}`);
  }

  /**
   * Setup event handlers for the worker
   */
  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  /**
   * Close the worker
   */
  async close() {
    await this.worker.close();
    await redisConnection.disconnect();
  }
}

export const migrationWorker = new MigrationWorker(); 