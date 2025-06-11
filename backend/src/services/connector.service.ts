import { PrismaClient } from '@prisma/client';
import { ConnectorFactory } from '../connectors/base/ConnectorFactory';
import { ConnectorInterface, ConnectionTestResult, ExtractedData, ExtractionOptions } from '../connectors/base/ConnectorInterface';
import { TimelineService } from './timeline.service';

const prisma = new PrismaClient();

export class ConnectorService {
  /**
   * Test connection for a connector
   */
  static async testConnection(connectorId: string, tenantId: string): Promise<ConnectionTestResult> {
    try {
      // Get connector from database
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: connectorId,
          tenantId: tenantId
        }
      });

      if (!connector) {
        return {
          success: false,
          message: 'Connector not found'
        };
      }

      // Create connector instance
      const connectorInstance = ConnectorFactory.createConnector(
        connector.connectorType,
        connector.config as any,
        connectorId
      );

      // Test connection
      const result = await connectorInstance.testConnection();
      
      // Update connector status based on test result
      await prisma.tenantConnector.update({
        where: { id: connectorId },
        data: {
          status: result.success ? 'ACTIVE' : 'ERROR',
          updatedAt: new Date()
        }
      });

      return result;
    } catch (error: any) {
      console.error('Connector test failed:', error);
      
      // Update connector status to ERROR
      try {
        await prisma.tenantConnector.update({
          where: { id: connectorId },
          data: {
            status: 'ERROR',
            updatedAt: new Date()
          }
        });
      } catch (updateError) {
        console.error('Failed to update connector status:', updateError);
      }

      return {
        success: false,
        message: error.message || 'Connection test failed',
        details: error
      };
    }
  }

  /**
   * Extract data from a connector with progress tracking
   */
  static async extractDataWithProgress(
    connectorId: string,
    tenantId: string,
    options: ExtractionOptions,
    progressCallback?: (current: number, total: number, phase?: string) => Promise<void>
  ): Promise<ExtractedData> {
    try {
      // Get connector from database
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: connectorId,
          tenantId: tenantId,
          status: 'ACTIVE'
        }
      });

      if (!connector) {
        throw new Error('Active connector not found');
      }

      // Create connector instance
      const connectorInstance = ConnectorFactory.createConnector(
        connector.connectorType,
        connector.config as any,
        connectorId
      );

      // Extract data with progress tracking
      const extractedData = await connectorInstance.extractDataWithProgress(options, progressCallback);

      // Transform data to internal format
      const transformedData = connectorInstance.transformData(
        options.entityType,
        extractedData.records
      );

      return {
        ...extractedData,
        records: transformedData
      };
    } catch (error: any) {
      console.error('Data extraction with progress failed:', error);
      throw new Error(`Data extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract data with progress tracking AND common timeline logging
   * 🚀 NEW: Standardized timeline events for all connector types
   */
  static async extractDataWithProgressAndTimeline(
    connectorId: string,
    tenantId: string,
    options: ExtractionOptions,
    jobId: string,
    progressCallback?: (current: number, total: number, phase?: string) => Promise<void>
  ): Promise<ExtractedData> {
    // 📊 Log extraction start for this entity
    await TimelineService.logEvent({
      jobId,
      tenantId,
      eventType: 'progress_update',
      message: `Starting ${options.entityType} extraction from ${await this.getConnectorDisplayName(connectorId, tenantId)}`,
      metadata: { 
        currentEntity: options.entityType,
        phase: 'starting_extraction'
      }
    });

    try {
      // 🔄 Create timeline-aware progress callback that preserves cancellation
      let lastLoggedProgress = 0;
      const timelineProgressCallback = progressCallback ? async (current: number, total: number, phase?: string) => {
        // 🚨 CRITICAL: Always call original callback first (preserves cancellation!)
        await progressCallback(current, total, phase);
        
        // 📊 Add timeline logging at reasonable intervals (every 10% or every 50 records)
        const progressPercent = Math.floor((current / total) * 100);
        const shouldLog = (
          progressPercent >= lastLoggedProgress + 10 || // Every 10%
          (current - lastLoggedProgress) >= 50 ||       // Every 50 records
          current === total                             // Always log completion
        );
        
        if (shouldLog) {
          await TimelineService.logEvent({
            jobId,
            tenantId,
            eventType: 'progress_update',
            message: `Processing ${options.entityType}: ${current}/${total} records (${progressPercent}%)`,
            metadata: { 
              currentEntity: options.entityType,
              recordsProcessed: current,
              totalRecords: total,
              percentage: progressPercent,
              phase: phase || 'extracting'
            }
          });
          lastLoggedProgress = current;
        }
      } : undefined;

      // 🔗 Call existing method with timeline-enhanced callback
      const extractedData = await this.extractDataWithProgress(
        connectorId,
        tenantId,
        options,
        timelineProgressCallback
      );

      // 📊 Log extraction completion
      await TimelineService.logEvent({
        jobId,
        tenantId,
        eventType: 'progress_update',
        message: `Completed ${options.entityType} extraction: ${extractedData.records.length} records processed`,
        metadata: { 
          currentEntity: options.entityType,
          recordsProcessed: extractedData.records.length,
          totalRecords: extractedData.totalCount || extractedData.records.length,
          percentage: 100,
          phase: 'extraction_complete'
        }
      });

      return extractedData;
    } catch (error: any) {
      // 📊 Log extraction error
      await TimelineService.logEvent({
        jobId,
        tenantId,
        eventType: 'error',
        message: `Error during ${options.entityType} extraction: ${error.message}`,
        metadata: { 
          currentEntity: options.entityType,
          error: error.message,
          phase: 'extraction_error'
        }
      });
      
      throw error; // Re-throw to preserve existing error handling
    }
  }

  /**
   * Helper: Get display name for connector
   */
  private static async getConnectorDisplayName(connectorId: string, tenantId: string): Promise<string> {
    try {
      const connector = await prisma.tenantConnector.findFirst({
        where: { id: connectorId, tenantId },
        select: { name: true, connectorType: true }
      });
      return connector ? `${connector.name} (${connector.connectorType})` : 'Unknown Connector';
    } catch {
      return 'Unknown Connector';
    }
  }

  /**
   * Extract data from a connector (original method without progress tracking)
   */
  static async extractData(
    connectorId: string,
    tenantId: string,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    try {
      // Get connector from database
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: connectorId,
          tenantId: tenantId,
          status: 'ACTIVE'
        }
      });

      if (!connector) {
        throw new Error('Active connector not found');
      }

      // Create connector instance
      const connectorInstance = ConnectorFactory.createConnector(
        connector.connectorType,
        connector.config as any,
        connectorId
      );

      // Extract data
      const extractedData = await connectorInstance.extractData(options);

      // Transform data to internal format
      const transformedData = connectorInstance.transformData(
        options.entityType,
        extractedData.records
      );

      return {
        ...extractedData,
        records: transformedData
      };
    } catch (error: any) {
      console.error('Data extraction failed:', error);
      throw new Error(`Data extraction failed: ${error.message}`);
    }
  }

  /**
   * Get supported entities for a connector
   */
  static async getSupportedEntities(connectorId: string, tenantId: string): Promise<string[]> {
    try {
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: connectorId,
          tenantId: tenantId
        }
      });

      if (!connector) {
        throw new Error('Connector not found');
      }

      const connectorInstance = ConnectorFactory.createConnector(
        connector.connectorType,
        connector.config as any,
        connectorId
      );

      return connectorInstance.getSupportedEntities();
    } catch (error: any) {
      console.error('Failed to get supported entities:', error);
      throw new Error(`Failed to get supported entities: ${error.message}`);
    }
  }

  /**
   * Get entity schema for a connector
   */
  static async getEntitySchema(
    connectorId: string,
    tenantId: string,
    entityType: string
  ): Promise<Record<string, any>> {
    try {
      const connector = await prisma.tenantConnector.findFirst({
        where: {
          id: connectorId,
          tenantId: tenantId
        }
      });

      if (!connector) {
        throw new Error('Connector not found');
      }

      const connectorInstance = ConnectorFactory.createConnector(
        connector.connectorType,
        connector.config as any,
        connectorId
      );

      return connectorInstance.getEntitySchema(entityType);
    } catch (error: any) {
      console.error('Failed to get entity schema:', error);
      throw new Error(`Failed to get entity schema: ${error.message}`);
    }
  }

  /**
   * Get connector types and their metadata
   */
  static getConnectorTypes(): any[] {
    const supportedTypes = ConnectorFactory.getSupportedTypes();
    
    return supportedTypes.map(type => {
      try {
        return ConnectorFactory.getConnectorMetadata(type);
      } catch (error) {
        console.error(`Failed to get metadata for ${type}:`, error);
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Validate connector configuration
   */
  static validateConnectorConfig(type: string, config: any): { valid: boolean; errors: string[] } {
    try {
      const metadata = ConnectorFactory.getConnectorMetadata(type);
      const errors: string[] = [];

      if (!metadata.configSchema) {
        return { valid: true, errors: [] };
      }

      // Validate required fields
      for (const [field, schema] of Object.entries(metadata.configSchema)) {
        const fieldSchema = schema as any;
        
        if (fieldSchema.required && (!config[field] || config[field].trim() === '')) {
          errors.push(`${field} is required`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Invalid connector type: ${type}`]
      };
    }
  }

  /**
   * Create connector instance for testing (without database)
   */
  static createConnectorInstance(type: string, config: any): ConnectorInterface {
    return ConnectorFactory.createConnector(type, config);
  }
} 