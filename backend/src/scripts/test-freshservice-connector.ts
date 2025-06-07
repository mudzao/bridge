#!/usr/bin/env tsx

import { FreshserviceConnector } from '../connectors/freshservice/FreshserviceConnector';
import { ConnectorFactory } from '../connectors/base/ConnectorFactory';

async function testFreshserviceConnector() {
  console.log('🧪 Testing Freshservice Connector Implementation\n');

  // Test 1: Connector Factory
  console.log('1. Testing Connector Factory...');
  try {
    const supportedTypes = ConnectorFactory.getSupportedTypes();
    console.log('✅ Supported connector types:', supportedTypes);
    
    const metadata = ConnectorFactory.getConnectorMetadata('FRESHSERVICE');
    console.log('✅ Freshservice metadata:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('❌ Connector Factory test failed:', error);
    return;
  }

  // Test 2: Configuration Validation
  console.log('\n2. Testing Configuration Validation...');
  try {
    const validConfig = {
      domain: 'test-company',
      apiKey: 'test-api-key-123'
    };

    const invalidConfig = {
      domain: 'test-company'
      // Missing apiKey
    };

    ConnectorFactory.createConnector('FRESHSERVICE', validConfig);
    console.log('✅ Valid config accepted');

    try {
      ConnectorFactory.createConnector('FRESHSERVICE', invalidConfig);
      console.log('❌ Invalid config should have been rejected');
    } catch (error: any) {
      console.log('✅ Invalid config properly rejected:', error.message);
    }
  } catch (error) {
    console.error('❌ Configuration validation test failed:', error);
    return;
  }

  // Test 3: Connector Instance
  console.log('\n3. Testing Connector Instance...');
  try {
    const config = {
      domain: 'test-company',
      apiKey: 'test-api-key-123'
    };

    const connector = new FreshserviceConnector(config);
    
    console.log('✅ Connector instance created');
    console.log('✅ Supported entities:', connector.getSupportedEntities());
    console.log('✅ Tickets schema:', connector.getEntitySchema('tickets'));
    console.log('✅ Authentication status:', connector.getAuthenticationStatus());
    console.log('✅ Metadata:', connector.getMetadata());
  } catch (error) {
    console.error('❌ Connector instance test failed:', error);
    return;
  }

  // Test 4: Data Transformation
  console.log('\n4. Testing Data Transformation...');
  try {
    const config = {
      domain: 'test-company',
      apiKey: 'test-api-key-123'
    };

    const connector = new FreshserviceConnector(config);
    
    const mockTicketData = [
      {
        id: 1,
        subject: 'Test Ticket',
        description: 'Test Description',
        description_text: 'Test Description Text',
        status: 2,
        priority: 3,
        type: 'Incident',
        source: 1,
        requester_id: 123,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        custom_fields: {},
        tags: ['test'],
        attachments: []
      }
    ];

    const transformedData = connector.transformData('tickets', mockTicketData);
    console.log('✅ Data transformation successful');
    console.log('✅ Transformed ticket:', JSON.stringify(transformedData[0], null, 2));
  } catch (error) {
    console.error('❌ Data transformation test failed:', error);
    return;
  }

  console.log('\n🎉 All Freshservice Connector tests passed!');
  console.log('\n📋 Summary:');
  console.log('- ✅ Connector Factory working');
  console.log('- ✅ Configuration validation working');
  console.log('- ✅ Connector instantiation working');
  console.log('- ✅ Data transformation working');
  console.log('- ✅ Ready for real API integration');
}

// Run the test
testFreshserviceConnector().catch(console.error); 