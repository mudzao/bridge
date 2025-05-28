import { ConnectorInterface, ConnectorConfig } from './ConnectorInterface';
import { FreshserviceConnector } from '../freshservice/FreshserviceConnector';

export class ConnectorFactory {
  /**
   * Create a connector instance based on the connector type
   */
  static createConnector(type: string, config: ConnectorConfig): ConnectorInterface {
    switch (type.toUpperCase()) {
      case 'FRESHSERVICE':
        return new FreshserviceConnector(config);
      
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }

  /**
   * Get list of supported connector types
   */
  static getSupportedTypes(): string[] {
    return ['FRESHSERVICE'];
  }

  /**
   * Check if a connector type is supported
   */
  static isSupported(type: string): boolean {
    return this.getSupportedTypes().includes(type.toUpperCase());
  }

  /**
   * Get connector metadata for a specific type
   */
  static getConnectorMetadata(type: string): any {
    switch (type.toUpperCase()) {
      case 'FRESHSERVICE':
        return {
          name: 'Freshservice',
          type: 'FRESHSERVICE',
          authType: 'api_key',
          supportedEntities: ['tickets', 'assets', 'users', 'groups'],
          configSchema: {
            domain: { type: 'string', required: true, description: 'Freshservice domain (e.g., company.freshservice.com)' },
            apiKey: { type: 'string', required: true, description: 'Freshservice API key' }
          }
        };
      
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }
} 