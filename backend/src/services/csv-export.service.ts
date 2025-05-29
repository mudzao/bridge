import { PrismaClient } from '@prisma/client';
import * as csv from 'csv-stringify';
import { Readable } from 'stream';

const prisma = new PrismaClient();

export interface CSVExportOptions {
  jobId: string;
  tenantId: string;
  entityType?: string;
  format?: 'csv' | 'json';
  includeRawData?: boolean;
}

export interface ExportSummary {
  jobId: string;
  entityType: string;
  recordCount: number;
  extractionTimestamp: Date;
  sourceSystem: string;
  fileSize?: number;
}

export class CSVExportService {
  /**
   * Generate CSV for a specific entity type
   */
  async generateEntityCSV(options: CSVExportOptions): Promise<Buffer> {
    const { jobId, tenantId, entityType } = options;

    if (!entityType) {
      throw new Error('Entity type is required for entity CSV generation');
    }

    // Get extracted data for the entity
    const extractedData = await prisma.jobExtractedData.findMany({
      where: {
        jobId,
        tenantId,
        entityType,
      },
      orderBy: {
        batchNumber: 'asc',
      },
    });

    if (extractedData.length === 0) {
      throw new Error(`No data found for entity type: ${entityType}`);
    }

    // Combine all batches
    const allRecords = [];
    for (const batch of extractedData) {
      const records = options.includeRawData 
        ? batch.rawData as any[]
        : batch.transformedData as any[];
      
      if (Array.isArray(records)) {
        // Add metadata to each record
        const enrichedRecords = records.map(record => ({
          ...record,
          _extraction_timestamp: batch.extractionTimestamp.toISOString(),
          _source_system: batch.sourceSystem,
          _batch_number: batch.batchNumber,
        }));
        allRecords.push(...enrichedRecords);
      }
    }

    if (allRecords.length === 0) {
      throw new Error(`No records found for entity type: ${entityType}`);
    }

    // Generate CSV
    return this.recordsToCSV(allRecords);
  }

  /**
   * Generate a ZIP file containing CSV files for all entities in a job
   */
  async generateFullExport(options: CSVExportOptions): Promise<Buffer> {
    const { jobId, tenantId } = options;

    // Get all entity types for this job
    const entityTypes = await prisma.jobExtractedData.findMany({
      where: { jobId, tenantId },
      select: { entityType: true },
      distinct: ['entityType'],
    });

    if (entityTypes.length === 0) {
      throw new Error('No extracted data found for this job');
    }

    const JSZip = require('jszip');
    const zip = new JSZip();

    // Add CSV for each entity type
    for (const { entityType } of entityTypes) {
      try {
        const csvBuffer = await this.generateEntityCSV({
          ...options,
          entityType,
        });
        
        zip.file(`${entityType}.csv`, csvBuffer);
      } catch (error: any) {
        console.error(`Failed to generate CSV for ${entityType}:`, error);
        // Add error file instead
        const errorMessage = error?.message || 'Unknown error';
        zip.file(`${entityType}_error.txt`, `Failed to generate CSV: ${errorMessage}`);
      }
    }

    // Add job summary
    const summary = await this.getExtractionSummary(jobId, tenantId);
    zip.file('extraction_summary.json', JSON.stringify(summary, null, 2));

    return zip.generateAsync({ type: 'nodebuffer' });
  }

  /**
   * Get extraction summary for a job
   */
  async getExtractionSummary(jobId: string, tenantId: string): Promise<ExportSummary[]> {
    const job = await prisma.job.findUnique({
      where: { id: jobId, tenantId },
      include: {
        extractedData: true,
        sourceConnector: true,
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // Group by entity type and sum records
    const summaryMap = new Map<string, ExportSummary>();

    for (const data of job.extractedData) {
      const key = data.entityType;
      
      if (summaryMap.has(key)) {
        const existing = summaryMap.get(key)!;
        existing.recordCount += data.recordCount;
        // Keep the latest extraction timestamp
        if (data.extractionTimestamp > existing.extractionTimestamp) {
          existing.extractionTimestamp = data.extractionTimestamp;
        }
      } else {
        summaryMap.set(key, {
          jobId,
          entityType: data.entityType,
          recordCount: data.recordCount,
          extractionTimestamp: data.extractionTimestamp,
          sourceSystem: data.sourceSystem,
        });
      }
    }

    return Array.from(summaryMap.values());
  }

  /**
   * Stream CSV generation for large datasets
   */
  async streamEntityCSV(options: CSVExportOptions): Promise<Readable> {
    const { jobId, tenantId, entityType } = options;

    if (!entityType) {
      throw new Error('Entity type is required for streaming CSV generation');
    }

    // Create readable stream from database
    const extractedData = await prisma.jobExtractedData.findMany({
      where: { jobId, tenantId, entityType },
      orderBy: { batchNumber: 'asc' },
    });

    if (extractedData.length === 0) {
      throw new Error(`No data found for entity type: ${entityType}`);
    }

    // Create a readable stream
    let batchIndex = 0;
    let recordIndex = 0;
    let currentBatch: any[] = [];
    let headers: string[] = [];
    let headersWritten = false;

    const readable = new Readable({
      objectMode: true,
      read() {
        try {
          // Load next batch if current is exhausted
          if (recordIndex >= currentBatch.length) {
            if (batchIndex >= extractedData.length) {
              this.push(null); // End of stream
              return;
            }

            const batch = extractedData[batchIndex];
            if (batch) {
              const records = options.includeRawData 
                ? batch.rawData as any[]
                : batch.transformedData as any[];

              currentBatch = Array.isArray(records) ? records.map(record => ({
                ...record,
                _extraction_timestamp: batch.extractionTimestamp.toISOString(),
                _source_system: batch.sourceSystem,
                _batch_number: batch.batchNumber,
              })) : [];

              recordIndex = 0;
              batchIndex++;

              // Extract headers from first record
              if (!headersWritten && currentBatch.length > 0) {
                headers = Object.keys(currentBatch[0]);
                headersWritten = true;
                this.push({ headers });
              }
            }
          }

          // Push next record
          if (recordIndex < currentBatch.length) {
            this.push({ record: currentBatch[recordIndex] });
            recordIndex++;
          }
        } catch (error) {
          this.emit('error', error);
        }
      }
    });

    return readable;
  }

  /**
   * Convert records to CSV buffer
   */
  private async recordsToCSV(records: any[]): Promise<Buffer> {
    if (records.length === 0) {
      throw new Error('No records to convert to CSV');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      // Extract headers from first record
      const headers = Object.keys(records[0]);
      
      const csvStream = csv.stringify({
        header: true,
        columns: headers,
        cast: {
          date: (value) => value instanceof Date ? value.toISOString() : value,
          object: (value) => typeof value === 'object' ? JSON.stringify(value) : value,
        }
      });

      csvStream.on('data', (chunk) => chunks.push(chunk));
      csvStream.on('end', () => resolve(Buffer.concat(chunks)));
      csvStream.on('error', reject);

      // Write all records
      records.forEach(record => csvStream.write(record));
      csvStream.end();
    });
  }

  /**
   * Validate job access and return job info
   */
  async validateJobAccess(jobId: string, tenantId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId, tenantId },
      include: {
        sourceConnector: true,
        extractedData: {
          select: {
            entityType: true,
            recordCount: true,
            extractionTimestamp: true,
          }
        }
      }
    });

    if (!job) {
      throw new Error('Job not found or access denied');
    }

    if (job.status !== 'DATA_READY' && job.status !== 'COMPLETED') {
      throw new Error(`Job is not ready for export. Current status: ${job.status}`);
    }

    return job;
  }

  /**
   * Get available entity types for a job
   */
  async getAvailableEntityTypes(jobId: string, tenantId: string): Promise<string[]> {
    const entityTypes = await prisma.jobExtractedData.findMany({
      where: { jobId, tenantId },
      select: { entityType: true },
      distinct: ['entityType'],
    });

    return entityTypes.map(et => et.entityType);
  }

  /**
   * Get data preview for validation
   */
  async getDataPreview(jobId: string, tenantId: string, entityType: string, limit: number = 5) {
    const extractedData = await prisma.jobExtractedData.findFirst({
      where: { jobId, tenantId, entityType },
      orderBy: { batchNumber: 'asc' },
    });

    if (!extractedData) {
      throw new Error(`No data found for entity type: ${entityType}`);
    }

    const records = extractedData.transformedData as any[];
    const preview = Array.isArray(records) ? records.slice(0, limit) : [];
    
    return {
      entityType,
      recordCount: extractedData.recordCount,
      extractionTimestamp: extractedData.extractionTimestamp,
      sourceSystem: extractedData.sourceSystem,
      preview,
    };
  }
}

export const csvExportService = new CSVExportService(); 