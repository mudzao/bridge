import { PrismaClient } from '@prisma/client';
import { ConnectorFactory } from '../connectors/base/ConnectorFactory';
import { ConnectorInterface, ConnectionTestResult, ExtractedData, ExtractionOptions } from '../connectors/base/ConnectorInterface';

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
        connector.config as any
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
   * Extract data from a connector
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
        connector.config as any
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
        connector.config as any
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
        connector.config as any
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