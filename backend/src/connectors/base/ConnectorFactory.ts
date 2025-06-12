import { ConnectorInterface, ConnectorConfig } from './ConnectorInterface';
import { FreshserviceConnector } from '../freshservice/FreshserviceConnector';
import { ManageEngineSdpConnector } from '../manageengine-sdp/ManageEngineSdpConnector';

export class ConnectorFactory {
  /**
   * Create a connector instance based on the connector type
   */
  static createConnector(type: string, config: ConnectorConfig, connectorId?: string): ConnectorInterface {
    switch (type.toUpperCase()) {
      case 'FRESHSERVICE':
        return new FreshserviceConnector(config, connectorId);
      case 'MANAGEENGINE_SDP':
        return new ManageEngineSdpConnector(config, connectorId);
      
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }

  /**
   * Get list of supported connector types
   */
  static getSupportedTypes(): string[] {
    return ['FRESHSERVICE', 'MANAGEENGINE_SDP'];
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
          id: 'FRESHSERVICE',
          name: 'FreshService',
          type: 'FRESHSERVICE',
          description: 'ITSM platform for service management',
          authType: 'api_key',
          icon: 'Server', // Icon identifier for frontend
          supportedEntities: ['tickets', 'assets', 'users', 'groups'],
          configSchema: {
            domain: { 
              type: 'string', 
              required: true, 
              description: 'Domain', 
              placeholder: 'company.freshservice.com',
              help: 'Your Freshservice domain (without https://)'
            },
            apiKey: { 
              type: 'string', 
              required: true, 
              description: 'API Key', 
              placeholder: 'Your Freshservice API Key',
              sensitive: true,
              help: 'API key from your Freshservice admin settings'
            }
          }
        };
      case 'MANAGEENGINE_SDP':
        return {
          id: 'MANAGEENGINE_SDP',
          name: 'ManageEngine ServiceDesk Plus',
          type: 'MANAGEENGINE_SDP',
          description: 'ManageEngine ServiceDesk Plus ITSM platform',
          authType: 'oauth2',
          icon: 'Settings', // Icon identifier for frontend
          supportedEntities: ['tickets', 'assets', 'users', 'problems', 'changes', 'projects', 'cmdb_items'],
          configSchema: {
            baseUrl: { 
              type: 'string', 
              required: true, 
              description: 'Base URL', 
              placeholder: 'https://company.sdpondemand.manageengine.com',
              help: 'Your ManageEngine SDP instance URL'
            },
            clientId: { 
              type: 'string', 
              required: true, 
              description: 'Client ID', 
              placeholder: 'Your OAuth 2.0 Client ID',
              help: 'OAuth 2.0 Client ID from your SDP OAuth app'
            },
            clientSecret: { 
              type: 'string', 
              required: true, 
              description: 'Client Secret', 
              placeholder: 'Your OAuth 2.0 Client Secret',
              sensitive: true,
              help: 'OAuth 2.0 Client Secret from your SDP OAuth app'
            },
            scope: { 
              type: 'string', 
              required: true, 
              description: 'Scope', 
              placeholder: 'SDPOnDemand.requests.READ,SDPOnDemand.assets.READ',
              default: 'SDPOnDemand.requests.READ,SDPOnDemand.assets.READ,SDPOnDemand.problems.READ,SDPOnDemand.changes.READ',
              help: 'Comma-separated list of OAuth scopes'
            },
            grantType: { 
              type: 'string', 
              required: false, 
              description: 'Grant Type', 
              enum: ['authorization_code', 'client_credentials'], 
              default: 'authorization_code',
              help: 'OAuth 2.0 grant type to use'
            },
            authorizationCode: { 
              type: 'string', 
              required: false, 
              description: 'Authorization Code', 
              placeholder: 'Required for authorization_code flow',
              help: 'Only required when using Authorization Code grant type'
            },
            redirectUri: { 
              type: 'string', 
              required: false, 
              description: 'Redirect URI', 
              placeholder: 'https://localhost',
              default: 'https://localhost',
              help: 'Redirect URI configured in your OAuth app'
            },
            dataCenterDomain: { 
              type: 'string', 
              required: false, 
              description: 'Data Center Domain', 
              enum: ['accounts.zoho.com', 'accounts.zoho.in', 'accounts.zoho.eu', 'accounts.zoho.com.au'], 
              default: 'accounts.zoho.com',
              help: 'Zoho data center for your region'
            }
          }
        };
      
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }
} 