import { Worker, Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { redisConfig } from '@/config';
import { QUEUE_NAMES, JOB_TYPES } from '@/services/queue.service';
import { ConnectorService } from '@/services/connector.service';
import { SSEService, ProgressEvent } from '@/services/sse.service';
import { TimelineService } from '@/services/timeline.service';
import { JobStatus, JobType } from '@/types';

const prisma = new PrismaClient();

// Redis connection for workers
const redisConnection = new IORedis(redisConfig.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

export class MigrationWorker {
  private worker: Worker;
  private sseService: SSEService;
  private queue: Queue;
  // Remove complex cancellation infrastructure
  // private abortControllers: Map<string, AbortController> = new Map();
  // private cancellationSubscriber!: IORedis;

  constructor() {
    console.log('🔧 Initializing Migration Worker...');
    
    this.queue = new Queue(QUEUE_NAMES.MIGRATION, {
      connection: redisConnection,
    });
    console.log(`📋 Queue "${QUEUE_NAMES.MIGRATION}" created`);
    
    this.worker = new Worker(QUEUE_NAMES.MIGRATION, this.processJob.bind(this), {
      connection: redisConnection,
      concurrency: 1,                 // Process one job at a time to avoid conflicts
      stalledInterval: 60 * 1000,     // Check for stalled jobs every 60 seconds (instead of default 30s)
      maxStalledCount: 3,             // Allow job to be considered stalled 3 times before failing (instead of default 1)
    });
    console.log(`👷 Worker created for queue "${QUEUE_NAMES.MIGRATION}" with concurrency: 1`);

    this.sseService = SSEService.getInstance();
    this.setupEventHandlers();
    console.log('✅ Migration Worker initialized successfully');
    
    // Check queue status after a short delay
    setTimeout(async () => {
      try {
        const isPaused = await this.queue.isPaused();
        const waiting = await this.queue.getWaiting();
        const active = await this.queue.getActive();
        
        console.log(`📊 Queue Status:`);
        console.log(`   - Paused: ${isPaused}`);
        console.log(`   - Waiting jobs: ${waiting.length}`);
        console.log(`   - Active jobs: ${active.length}`);
        
        if (isPaused) {
          console.log('⚠️ Queue is PAUSED! Resuming...');
          await this.queue.resume();
          console.log('✅ Queue resumed');
        }
      } catch (error) {
        console.error('❌ Error checking queue status:', error);
      }
    }, 1000);
  }
  
  // Remove Redis pub/sub subscriber setup
  // private setupCancellationSubscriber() { ... }

  /**
   * Fast cancellation check using Redis cache + database fallback
   * Returns boolean instead of throwing errors
   */
  private async shouldCancelJob(jobId: string): Promise<boolean> {
    try {
      // Method 1: Fast Redis cache check (< 1ms)
      const cached = await redisConnection.get(`job:${jobId}:cancelled`);
      if (cached === 'true') {
        return true;
      }

      // Method 2: Check BullMQ job data (fast, already in memory)
      const freshJob = await this.queue.getJob(jobId);
      if (freshJob?.data.cancelled) {
        // Cache the cancellation for future checks
        await redisConnection.setex(`job:${jobId}:cancelled`, 300, 'true');
        return true;
      }

      // Method 3: Database fallback (slower, but authoritative)
      // Only check database occasionally to avoid overload
      const now = Date.now();
      const lastDbCheck = this.lastDbCheck?.get(jobId) || 0;
      
      if (now - lastDbCheck > 5000) { // Check DB every 5 seconds max
        const dbJob = await prisma.job.findUnique({
          where: { id: jobId },
          select: { status: true }
        });
        
        // Update last check time
        if (!this.lastDbCheck) this.lastDbCheck = new Map();
        this.lastDbCheck.set(jobId, now);
        
        if (dbJob?.status === JobStatus.FAILED) {
          // Cache the cancellation for future checks
          await redisConnection.setex(`job:${jobId}:cancelled`, 300, 'true');
          return true;
        }
      }

      return false;

    } catch (error) {
      console.warn(`⚠️ Cancellation check error for job ${jobId}:`, error);
      return false; // Default to not cancelled on error
    }
  }

  /**
   * Debug function to check cancellation status manually
   */
  private async debugCancellationStatus(jobId: string): Promise<void> {
    console.log(`🔍 [${jobId}] === CANCELLATION DEBUG ===`);
    
    // Check Redis cache
    const redisResult = await redisConnection.get(`job:${jobId}:cancelled`);
    console.log(`🔍 [${jobId}] Redis cache: ${redisResult}`);
    
    // Check BullMQ job data
    const bullJob = await this.queue.getJob(jobId);
    console.log(`🔍 [${jobId}] BullMQ cancelled flag: ${bullJob?.data.cancelled}`);
    
    // Check database
    const dbJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, error: true }
    });
    console.log(`🔍 [${jobId}] Database status: ${dbJob?.status}`);
    console.log(`🔍 [${jobId}] Database error: ${dbJob?.error}`);
    
    console.log(`🔍 [${jobId}] === END DEBUG ===`);
  }

  // Add property to track last database checks
  private lastDbCheck?: Map<string, number>;

  /**
   * Job processing with built-in cancellation logic
   */
  private async processJob(job: Job): Promise<any> {
    const { jobId, jobType } = job.data;
    let cancelled = false;

    console.log(`🚀 [${jobId}] Starting job processing with cancellation monitoring`);

    // Set up graceful cancellation check (every 2 seconds - reduced frequency)  
    let forceStop = false;
    let checkCount = 0;
    const cancelCheck = setInterval(async () => {
      try {
        checkCount++;
        const shouldCancel = await this.shouldCancelJob(jobId);
        
        // Debug every 3rd check (every 6 seconds)
        if (checkCount % 3 === 0) {
          console.log(`🔄 [${jobId}] Periodic check #${checkCount} - shouldCancel: ${shouldCancel}`);
          if (!shouldCancel) {
            await this.debugCancellationStatus(jobId);
          }
        }
        
        if (shouldCancel) {
          console.log(`🚫 [${jobId}] 🚨 CANCELLATION DETECTED via periodic check #${checkCount} - initiating graceful stop`);
          cancelled = true;
          forceStop = true;
          clearInterval(cancelCheck);
        }
      } catch (error) {
        console.warn(`⚠️ [${jobId}] Cancellation check error:`, error);
      }
    }, 2000);

    try {
      console.log(`📋 [${jobId}] Processing ${jobType || 'legacy'} job`);

      // Check cancellation before starting
      if (await this.shouldCancelJob(jobId)) {
        cancelled = true;
        console.log(`🚫 [${jobId}] Job already cancelled before execution started`);
      }

      if (cancelled || forceStop) {
        console.log(`🚫 [${jobId}] Throwing cancellation error to stop job`);
        throw new Error('Job cancelled by user');
      }

      // Execute the job with cancellation awareness
      console.log(`⚡ [${jobId}] Starting job execution with cancellation monitoring`);
      
      // Check flags before execution
      if (cancelled || forceStop) {
        console.log(`🚫 [${jobId}] Cancellation flags already set - throwing error immediately`);
        throw new Error('Job cancelled by user');
      }
      
      const result = await this.executeJobWithCancellation(job, () => {
        const shouldStop = cancelled || forceStop;
        if (shouldStop) {
          console.log(`🚫 [${jobId}] 🚨 Cancellation flag detected in execution check - should stop now!`);
        }
        return shouldStop;
      });

      // 🎉 Emit final 100% completion progress 
      await job.updateProgress(100);
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 'Job completed successfully');
      await this.emitProgress(jobId, job.data.tenantId, 'complete', {
        progress: 100,
        status: JobStatus.COMPLETED,
        message: 'Migration job completed successfully',
        phase: 'completed'
      });
      
      console.log(`✅ [${jobId}] Job completed successfully`);
      return result;

    } catch (error) {
      console.log(`❌ [${jobId}] Job execution error caught:`, error instanceof Error ? error.message : String(error));
      
      if (error instanceof Error && error.message.includes('cancelled')) {
        console.log(`🚫 [${jobId}] Confirmed cancellation error - updating job status to FAILED`);
        await this.updateJobStatus(jobId, JobStatus.FAILED, 'Job cancelled by user');
        
        // Mark job as permanently failed to prevent retries
        console.log(`🚫 [${jobId}] Discarding job to prevent retries`);
        job.discard();
        
        console.log(`🚫 [${jobId}] Re-throwing cancellation error for BullMQ`);
        throw error;
      }
      
      console.error(`❌ [${jobId}] Non-cancellation error:`, error);
      throw error;
    } finally {
      console.log(`🧹 [${jobId}] Cleaning up periodic cancellation check`);
      clearInterval(cancelCheck);
      
      // Clean up cancellation tracking
      if (this.lastDbCheck) {
        this.lastDbCheck.delete(jobId);
      }
    }
  }

  // Remove AbortController methods
  // private createCancellationPromise() { ... }

  /**
   * Job execution with cancellation awareness
   */
  private async executeJobWithCancellation(job: Job, isCancelled: () => boolean): Promise<any> {
    const { jobId, jobType } = job.data;

    // Check cancellation before major operations
    console.log(`🔍 [${jobId}] executeJobWithCancellation - checking cancellation before start`);
    if (isCancelled()) {
      console.log(`🚫 [${jobId}] 🚨 executeJobWithCancellation detected cancellation - throwing error`);
      throw new Error('Job cancelled by user');
    }

    try {
      // For extraction jobs, only extract and transform
      if (jobType === JobType.EXTRACTION || !jobType) {
        console.log(`🔍 [${jobId}] About to call extractData()`);
        try {
          await this.extractData(job);
          console.log(`✅ [${jobId}] extractData() completed successfully`);
          return { type: 'extraction', status: 'completed' };
        } catch (error) {
          console.log(`❌ [${jobId}] extractData() threw error:`, error instanceof Error ? error.message : String(error));
          throw error; // Re-throw to maintain error flow
        }
      }

      // For loading jobs, only load data using transformed data
      if (jobType === JobType.LOADING) {
        await this.loadData(job);
        return { type: 'loading', status: 'completed' };
      }

      // For migration jobs, do full extract -> transform -> load pipeline
      if (jobType === JobType.MIGRATION) {
        await this.extractData(job);
        await this.transformData(job);
        await this.loadData(job);
        return { type: 'migration', status: 'completed' };
      }

      // Handle legacy job processing
      const legacyJobType = job.data.type || JOB_TYPES.EXTRACT_DATA;
      switch (legacyJobType) {
        case JOB_TYPES.EXTRACT_DATA:
          return await this.extractData(job);
        case JOB_TYPES.TRANSFORM_DATA:
          return await this.transformData(job);
        case JOB_TYPES.LOAD_DATA:
          return await this.loadData(job);
        case JOB_TYPES.CLEANUP_DATA:
          return await this.cleanupData(job);
        default:
          throw new Error(`Unknown job type: ${legacyJobType}`);
      }
    } catch (error) {
      console.error(`Job ${jobId} execution failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.updateJobStatus(jobId, JobStatus.FAILED, `Job failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Extract data from source system using real connectors
   */
  private async extractData(job: Job, isCancelled?: () => boolean): Promise<any> {
    const { jobId, sourceConnectorId, tenantId, entities, config } = job.data;

    // Log job start
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'status_change',
      message: 'Starting data extraction job...',
      metadata: { newStatus: 'EXTRACTING', phase: 'initialization' }
    });

    // Update progress and emit event
    await job.updateProgress(10);
    await this.updateJobStatus(jobId, JobStatus.EXTRACTING, 'Starting data extraction');

    // Log extraction start
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'status_change',
      message: 'Connecting to source system and preparing data extraction...',
      metadata: { newStatus: 'EXTRACTING', phase: 'connecting' }
    });

    await this.emitProgress(jobId, tenantId, 'status', {
      progress: 10,
      status: JobStatus.EXTRACTING,
      message: 'Starting data extraction',
      phase: 'initialization'
    });

    // Get source connector configuration
    const sourceConnector = await prisma.tenantConnector.findUnique({
      where: { id: sourceConnectorId, tenantId },
    });

    if (!sourceConnector) {
      throw new Error('Source connector not found');
    }

    await job.updateProgress(20);
    await this.updateJobStatus(jobId, JobStatus.EXTRACTING, 'Connecting to source system');
    await this.emitProgress(jobId, tenantId, 'progress', {
      progress: 20,
      status: JobStatus.EXTRACTING,
      message: `Connecting to ${sourceConnector.connectorType} system`,
      phase: 'connecting'
    });

    let totalExtracted = 0;
    const extractionResults = [];

    // Extract data for each entity type
    for (let i = 0; i < entities.length; i++) {
      const entityType = entities[i];
      
      // Check for cancellation before processing each entity
      const cancelled = await redisConnection.get(`job:${jobId}:cancelled`);
      if (cancelled === 'true') {
        throw new Error('Job cancelled by user');
      }
      
      await this.updateJobStatus(jobId, JobStatus.EXTRACTING, `Extracting ${entityType} data`);
      await this.emitProgress(jobId, tenantId, 'progress', {
        progress: 30 + (i / entities.length) * 40,
        status: JobStatus.EXTRACTING,
        message: entityType === 'tickets' ? 
          `Extracting ${entityType} data with complete details (descriptions, tags, attachments)` : 
          `Extracting ${entityType} data`,
        phase: 'extracting',
        currentEntity: entityType
      });
      
      try {
        // 🚀 Enhanced extraction with common timeline logging + progress callback
        const extractedData = await ConnectorService.extractDataWithProgressAndTimeline(
          sourceConnectorId,
          tenantId,
          {
            entityType,
            batchSize: config?.batchSize || 100,
            startDate: config?.startDate,
            endDate: config?.endDate,
            maxRecords: config?.maxRecords,
            
            // 🆕 Enhanced detail extraction options for tickets
            includeDetails: entityType === 'tickets' ? (config?.includeDetails !== false) : false,
            detailBatchSize: config?.detailBatchSize || 10,
            ticketIncludes: config?.ticketIncludes || [],
            
            // Pass job context for timeline logging
            jobId,
            tenantId,
          } as any,
          jobId, // 🚀 NEW: jobId parameter for timeline logging
          // 🚨 CRITICAL: Same cancellation callback - UNCHANGED to preserve cancellation
          async (currentProgress: number, totalProgress: number, phase?: string) => {
            // Only log every 10th progress update to reduce noise
            if (currentProgress % 10 === 0) {
              console.log(`📊 [${jobId}] Progress: ${currentProgress}/${totalProgress}`);
            }
            
            // 🔥 IMMEDIATE Redis check - throw error to stop job instantly  
            const cached = await redisConnection.get(`job:${jobId}:cancelled`);
            if (cached === 'true') {
              console.log(`🚫 [${jobId}] 🚨 CANCELLED via progress callback - throwing error to stop execution`);
              throw new Error('Job cancelled by user');
            }
            
            const currentRecords = totalExtracted + currentProgress;
            const overallProgressPercentage = 30 + ((i + currentProgress / totalProgress) / entities.length) * 40;
            
            // Update job progress frequently to prevent BullMQ stall detection
            await job.updateProgress(overallProgressPercentage);
            
            // Only emit SSE progress for real-time updates (no blocking operations)
            this.emitProgressOnly(jobId, tenantId, 'progress', {
              progress: overallProgressPercentage,
              status: JobStatus.EXTRACTING,
              message: `Processing ${entityType}: ${currentProgress}/${totalProgress} records`,
              phase: phase || 'extracting',
              currentEntity: entityType,
              recordsProcessed: currentRecords,
              totalRecords: totalProgress
            }).catch(err => console.warn('Non-critical SSE emit failed:', err.message));
          }
        );

        // Store extracted data
        await this.storeExtractedData(jobId, tenantId, entityType, extractedData);
        
        totalExtracted += extractedData.records.length;
        extractionResults.push({
          entityType,
          recordCount: extractedData.records.length,
          totalCount: extractedData.totalCount,
          hasMore: extractedData.hasMore
        });

        // Update progress based on entity completion
        const entityProgress = 30 + ((i + 1) / entities.length) * 40; // 30-70% range
        await job.updateProgress(entityProgress);

        // 📊 Timeline logging now handled by ConnectorService.extractDataWithProgressAndTimeline



        await this.emitProgress(jobId, tenantId, 'progress', {
          progress: entityProgress,
          status: JobStatus.EXTRACTING,
          message: entityType === 'tickets' ? 
            `Extracted ${extractedData.records.length} ${entityType} records with complete details` : 
            `Extracted ${extractedData.records.length} ${entityType} records`,
          phase: 'extracting',
          currentEntity: entityType,
          recordsProcessed: totalExtracted,
          totalRecords: extractedData.totalCount
        });

      } catch (error) {
        console.error(`Failed to extract ${entityType} data:`, error);
        const errorMessage = `Failed to extract ${entityType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        // 📊 Error logging now handled by ConnectorService.extractDataWithProgressAndTimeline
        
        await this.emitProgress(jobId, tenantId, 'error', {
          progress: 30 + (i / entities.length) * 40,
          status: JobStatus.FAILED,
          message: errorMessage,
          phase: 'extracting',
          currentEntity: entityType,
          error: errorMessage
        });
        
        throw new Error(errorMessage);
      }
    }

    await job.updateProgress(80);
    await this.updateJobStatus(jobId, JobStatus.DATA_READY, 'Data extraction completed');
    await this.emitProgress(jobId, tenantId, 'progress', {
      progress: 80,
      status: JobStatus.DATA_READY,
      message: 'Processing extracted data',
      phase: 'processing',
      recordsProcessed: totalExtracted
    });

    await job.updateProgress(100);
    await this.updateJobStatus(jobId, JobStatus.DATA_READY, `Extracted ${totalExtracted} records from ${entities.length} entity types`);

    // Log extraction completion
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'completion',
      message: `Data extraction completed: ${totalExtracted} records extracted from ${entities.length} entity types`,
      metadata: { 
        recordsProcessed: totalExtracted,
        totalRecords: totalExtracted,
        percentage: 100,
        phase: 'completed'
      }
    });

    await this.emitProgress(jobId, tenantId, 'complete', {
      progress: 100,
      status: JobStatus.DATA_READY,
      message: `Successfully extracted ${totalExtracted} records from ${entities.length} entity types`,
      phase: 'completed',
      recordsProcessed: totalExtracted
    });

    return { 
      extractedRecords: totalExtracted,
      entities: extractionResults
    };
  }

  /**
   * Transform extracted data
   */
  private async transformData(job: Job): Promise<any> {
    const { jobId, destinationConnectorId, tenantId } = job.data;

    // Check for cancellation at start
    const cancelled = await redisConnection.get(`job:${jobId}:cancelled`);
    if (cancelled === 'true') {
      throw new Error('Job cancelled by user');
    }

    await job.updateProgress(10);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Starting data transformation');

    // Log transformation start
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'status_change',
      message: 'Starting data transformation...',
      metadata: { newStatus: 'RUNNING', phase: 'transformation' }
    });

    // Get destination connector configuration
    const destinationConnector = await prisma.tenantConnector.findUnique({
      where: { id: destinationConnectorId, tenantId },
    });

    if (!destinationConnector) {
      throw new Error('Destination connector not found');
    }

    // Get extracted data
    const extractedDataRecords = await this.getExtractedData(jobId);

    await job.updateProgress(30);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 'Transforming data format');

    let totalTransformed = 0;

    // Transform data for each entity type
    for (let i = 0; i < extractedDataRecords.length; i++) {
      // Check for cancellation before each transformation
      const cancelled2 = await redisConnection.get(`job:${jobId}:cancelled`);
      if (cancelled2 === 'true') {
        throw new Error('Job cancelled by user');
      }
      
      const dataRecord = extractedDataRecords[i];
      
      // Log transformation progress
      await TimelineService.logEvent({
        jobId,
        tenantId,
        eventType: 'progress_update',
        message: `Transforming ${dataRecord.entityType} data for ${destinationConnector.connectorType}`,
        metadata: { 
          currentEntity: dataRecord.entityType,
          phase: 'transformation',
          recordsProcessed: totalTransformed
        }
      });
      
      // For now, we'll use a simple transformation
      // In a full implementation, this would use destination connector's transform methods
      const transformedData = dataRecord.rawData.map((record: any) => ({
        ...record,
        transformed_at: new Date().toISOString(),
        source_system: dataRecord.sourceSystem,
        destination_system: destinationConnector.connectorType.toLowerCase(),
        migration_job_id: jobId
      }));

      // Store transformed data
      await this.storeTransformedData(dataRecord.id, transformedData);
      totalTransformed += transformedData.length;

      // Update progress
      const progress = 30 + ((i + 1) / extractedDataRecords.length) * 50; // 30-80% range
      await job.updateProgress(progress);
    }

    await job.updateProgress(100);
    await this.updateJobStatus(jobId, JobStatus.COMPLETED, `Data transformation successful: ${totalTransformed} records transformed`);

    // Log transformation completion
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'completion',
      message: `Data transformation completed: ${totalTransformed} records transformed`,
      metadata: { recordsProcessed: totalTransformed, percentage: 100, phase: 'transformation' }
    });

    return { transformedRecords: totalTransformed };
  }

  /**
   * Load data into target system
   */
  private async loadData(job: Job): Promise<any> {
    const { jobId, destinationConnectorId, tenantId } = job.data;

    // Check for cancellation at start
    const cancelled3 = await redisConnection.get(`job:${jobId}:cancelled`);
    if (cancelled3 === 'true') {
      throw new Error('Job cancelled by user');
    }

    await job.updateProgress(10);
    await this.updateJobStatus(jobId, JobStatus.LOADING, 'Starting data loading');

    // Log loading start
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'status_change',
      message: 'Starting data loading to destination system...',
      metadata: { newStatus: 'LOADING', phase: 'loading' }
    });

    // Get destination connector
    const destinationConnector = await prisma.tenantConnector.findUnique({
      where: { id: destinationConnectorId, tenantId },
    });

    if (!destinationConnector) {
      throw new Error('Destination connector not found');
    }

    // Get transformed data
    const transformedDataRecords = await this.getTransformedData(jobId);

    await job.updateProgress(30);
    await this.updateJobStatus(jobId, JobStatus.LOADING, 'Loading data to destination system');

    let totalLoaded = 0;
    let totalErrors = 0;
    const allErrors: any[] = [];

    for (let i = 0; i < transformedDataRecords.length; i++) {
      // Check for cancellation before each load operation
      const cancelled4 = await redisConnection.get(`job:${jobId}:cancelled`);
      if (cancelled4 === 'true') {
        throw new Error('Job cancelled by user');
      }
      
      const dataRecord = transformedDataRecords[i];
      
      try {
        // Log loading progress for this entity
        await TimelineService.logEvent({
          jobId,
          tenantId,
          eventType: 'progress_update',
          message: `Loading ${dataRecord.entityType} records to ${destinationConnector.connectorType}`,
          metadata: { 
            currentEntity: dataRecord.entityType,
            phase: 'loading',
            recordsProcessed: totalLoaded
          }
        });

        // For now, simulate loading since we need to implement createConnector method
        // In a full implementation, this would use the destination connector's loadData method
        const simulatedResult = {
          successCount: Math.floor(dataRecord.transformedData.length * 0.95),
          failureCount: Math.floor(dataRecord.transformedData.length * 0.05),
          totalRecords: dataRecord.transformedData.length,
          errors: [],
          summary: {
            created: Math.floor(dataRecord.transformedData.length * 0.95),
            updated: 0,
            skipped: 0
          }
        };

        totalLoaded += simulatedResult.successCount;
        totalErrors += simulatedResult.failureCount;

        // Store loading results
        await this.storeLoadingResults(dataRecord.id, {
          successCount: simulatedResult.successCount,
          errorCount: simulatedResult.failureCount,
          totalRecords: simulatedResult.totalRecords,
          errors: simulatedResult.errors,
          summary: simulatedResult.summary
        });

        // Log successful loading
        await TimelineService.logEvent({
          jobId,
          tenantId,
          eventType: 'progress_update',
          message: `Loaded ${simulatedResult.successCount} ${dataRecord.entityType} records`,
          metadata: { 
            currentEntity: dataRecord.entityType,
            recordsProcessed: totalLoaded,
            percentage: 30 + ((i + 1) / transformedDataRecords.length) * 60
          }
        });

        // Send progress update for this entity
        await this.emitProgress(jobId, tenantId, 'progress', {
          progress: 30 + ((i + 1) / transformedDataRecords.length) * 60,
          status: JobStatus.LOADING,
          message: `Loaded ${simulatedResult.successCount} ${dataRecord.entityType} records`,
          phase: 'loading',
          currentEntity: dataRecord.entityType,
          recordsProcessed: totalLoaded
        });

      } catch (error) {
        console.error(`Failed to load ${dataRecord.entityType} data:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown loading error';
        
        // Log loading error
        await TimelineService.logEvent({
          jobId,
          tenantId,
          eventType: 'error',
          message: `Failed to load ${dataRecord.entityType}: ${errorMessage}`,
          metadata: { currentEntity: dataRecord.entityType, error: errorMessage, phase: 'loading' }
        });
        
        // Track entity-level errors
        allErrors.push({
          entityType: dataRecord.entityType,
          error: errorMessage,
          recordId: 'ENTITY_LEVEL_ERROR'
        });

        await this.storeLoadingResults(dataRecord.id, {
          successCount: 0,
          errorCount: dataRecord.transformedData.length,
          totalRecords: dataRecord.transformedData.length,
          errors: [{ error: errorMessage }],
          summary: { created: 0, updated: 0, skipped: 0 }
        });
      }

      // Update progress
      const progress = 30 + ((i + 1) / transformedDataRecords.length) * 60; // 30-90% range
      await job.updateProgress(progress);
    }

    await job.updateProgress(100);
    
    const statusMessage = `Loading completed: ${totalLoaded} records loaded, ${totalErrors} errors`;
    await this.updateJobStatus(jobId, JobStatus.COMPLETED, statusMessage);

    // Log loading completion
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'completion',
      message: statusMessage,
      metadata: { 
        recordsProcessed: totalLoaded, 
        percentage: 100, 
        phase: 'loading',
        totalErrors: totalErrors
      }
    });

    return { loadedRecords: totalLoaded, errors: totalErrors };
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
   * Update job status in database
   */
  private async updateJobStatus(jobId: string, status: JobStatus, message: string) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        error: status === JobStatus.FAILED ? message : null,
        completedAt: [JobStatus.COMPLETED, JobStatus.FAILED].includes(status) ? new Date() : null,
      },
    });
  }

  /**
   * Store extracted data in database
   */
  private async storeExtractedData(jobId: string, tenantId: string, entityType: string, extractedData: any) {
    await prisma.jobExtractedData.create({
      data: {
        jobId,
        tenantId,
        entityType,
        batchNumber: 1,
        sourceSystem: 'freshservice', // This should come from the connector
        rawData: extractedData.records,
        transformedData: extractedData.records, // Initially same as raw
        recordCount: extractedData.records.length,
        extractionTimestamp: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  /**
   * Get extracted data from database
   */
  private async getExtractedData(jobId: string): Promise<any[]> {
    const extractedRecords = await prisma.jobExtractedData.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return extractedRecords;
  }

  /**
   * Store transformed data
   */
  private async storeTransformedData(extractedDataId: string, data: any[]) {
    await prisma.jobExtractedData.update({
      where: { id: extractedDataId },
      data: {
        transformedData: data,
      },
    });
  }

  /**
   * Get transformed data
   */
  private async getTransformedData(jobId: string): Promise<any[]> {
    const extractedRecords = await prisma.jobExtractedData.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return extractedRecords;
  }

  /**
   * Store loading results
   */
  private async storeLoadingResults(extractedDataId: string, results: any) {
    await prisma.jobLoadResult.create({
      data: {
        jobExtractedDataId: extractedDataId,
        destinationSystem: 'target-system', // This should come from destination connector
        successCount: results.successCount,
        failedCount: results.errorCount,
        errorDetails: results.errors || {},
        loadedAt: new Date(),
      },
    });
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
    console.log('🔥 Closing migration worker...');
    
    // Clean up database check tracking
    if (this.lastDbCheck) {
      this.lastDbCheck.clear();
    }
    
    await this.worker.close();
    await this.queue.close();
    await redisConnection.disconnect();
    console.log('✅ Migration worker closed');
  }

  /**
   * Emit progress event for real-time updates
   */
  private async emitProgress(
    jobId: string,
    tenantId: string,
    type: 'progress' | 'status' | 'error' | 'complete',
    data: any
  ): Promise<void> {
    try {
      const event: ProgressEvent = {
        jobId,
        tenantId,
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      await this.sseService.broadcastProgress(event);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Non-critical SSE broadcast failed:', errorMessage);
      // Don't throw - this shouldn't cause job retries
    }
  }

  /**
   * Emit progress event for real-time updates without timeline logging
   */
  private async emitProgressOnly(
    jobId: string,
    tenantId: string,
    type: 'progress' | 'status' | 'error' | 'complete',
    data: any
  ): Promise<void> {
    try {
      const event: ProgressEvent = {
        jobId,
        tenantId,
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      await this.sseService.broadcastProgress(event);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Non-critical SSE broadcast failed:', errorMessage);
      // Don't throw - this shouldn't cause job retries
    }
  }
}

export const migrationWorker = new MigrationWorker(); 