# ManageEngine ServiceDesk Plus Connector

## Overview

The ManageEngine ServiceDesk Plus (SDP) connector enables data extraction from ManageEngine ServiceDesk Plus Cloud using OAuth 2.0 authentication. This connector supports the v3 API and provides comprehensive access to ITSM data including requests, assets, users, problems, changes, projects, and CMDB items.

## Features

- **OAuth 2.0 Authentication**: Secure authentication using OAuth 2.0 with support for both authorization code and client credentials flows
- **Comprehensive Entity Support**: Extract data from 7 different entity types
- **Rate Limiting**: Built-in rate limiting and retry mechanisms
- **Pagination**: Automatic handling of paginated responses
- **Date Filtering**: Support for date-based filtering during extraction
- **Data Transformation**: Automatic transformation from SDP format to standardized format

## Supported Entities

| Entity Type | Description | API Endpoint |
|-------------|-------------|--------------|
| `tickets` | Service requests and incident tickets | `/api/v3/requests` |
| `assets` | IT assets and equipment | `/api/v3/assets` |
| `users` | System users and requesters | `/api/v3/requesters` |
| `problems` | Problem records | `/api/v3/problems` |
| `changes` | Change requests | `/api/v3/changes` |
| `projects` | Project records | `/api/v3/projects` |
| `cmdb_items` | Configuration Management Database items | `/api/v3/cmdb/cis` |

## Configuration

### Required Configuration

```typescript
{
  baseUrl: string;           // ManageEngine SDP base URL
  clientId: string;          // OAuth 2.0 Client ID
  clientSecret: string;      // OAuth 2.0 Client Secret
  scope: string;             // OAuth 2.0 scope permissions
}
```

### Optional Configuration

```typescript
{
  grantType?: 'authorization_code' | 'client_credentials';  // Default: 'authorization_code'
  authorizationCode?: string;                               // Required for authorization_code flow
  redirectUri?: string;                                     // Default: 'https://localhost'
  dataCenterDomain?: string;                               // Default: 'accounts.zoho.com'
}
```

### Data Center Domains

ManageEngine SDP uses different Zoho data centers. Configure the appropriate domain:

- **Global**: `accounts.zoho.com` (default)
- **India**: `accounts.zoho.in`
- **Europe**: `accounts.zoho.eu`
- **Australia**: `accounts.zoho.com.au`

## OAuth 2.0 Setup

### Step 1: Register Your Application

1. Go to the appropriate Zoho Developer Console:
   - Global: https://api-console.zoho.com/
   - India: https://api-console.zoho.in/
   - Europe: https://api-console.zoho.eu/
   - Australia: https://api-console.zoho.com.au/

2. Click **Add Client** and choose your client type:
   - **Server Based Applications**: For web applications
   - **Self Client**: For server-to-server integration

3. Enter your application details:
   - **Client Name**: Your application name
   - **Client Domain**: Your domain (can be dummy for testing)
   - **Authorized Redirect URIs**: Your callback URL

4. Save the **Client ID** and **Client Secret**

### Step 2: Configure Scopes

ManageEngine SDP uses specific scopes for different modules. Common scopes include:

```
SDPOnDemand.requests.READ      # Read requests/tickets
SDPOnDemand.assets.READ        # Read assets
SDPOnDemand.problems.READ      # Read problems
SDPOnDemand.changes.READ       # Read changes
SDPOnDemand.projects.READ      # Read projects
SDPOnDemand.cmdb.READ          # Read CMDB items
SDPOnDemand.general.READ       # Read general data
```

For multiple scopes, separate with commas:
```
SDPOnDemand.requests.READ,SDPOnDemand.assets.READ,SDPOnDemand.problems.READ
```

### Step 3: Choose Authentication Flow

#### Authorization Code Flow (Recommended)

1. Generate authorization URL:
```
https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=YOUR_CLIENT_ID&scope=YOUR_SCOPE&redirect_uri=YOUR_REDIRECT_URI&access_type=offline
```

2. User authorizes and you receive authorization code
3. Configure connector with the authorization code

#### Client Credentials Flow

For server-to-server integration without user interaction:
1. Set `grantType` to `client_credentials`
2. No authorization code needed
3. Connector will automatically obtain access token

## Usage Examples

### Basic Configuration

```typescript
const config = {
  baseUrl: 'https://company.sdpondemand.manageengine.com',
  clientId: '1000.XXXXXXXXXXXXXXXXXXXXXXXXXX',
  clientSecret: 'your-client-secret',
  scope: 'SDPOnDemand.requests.READ,SDPOnDemand.assets.READ',
  grantType: 'authorization_code',
  authorizationCode: 'your-authorization-code',
  dataCenterDomain: 'accounts.zoho.com'
};
```

### Extract Tickets

```typescript
const extractionOptions = {
  entityType: 'tickets',
  batchSize: 50,
  maxRecords: 1000,
  startDate: '2024-01-01',
  filters: {
    'status.name': 'Open'
  }
};

const result = await connector.extractData(extractionOptions);
```

### Extract Assets

```typescript
const extractionOptions = {
  entityType: 'assets',
  batchSize: 100,
  filters: {
    'asset_state.name': 'In Use'
  }
};

const result = await connector.extractData(extractionOptions);
```

## Data Transformation

The connector automatically transforms SDP data into a standardized format:

### Tickets Transformation

```typescript
{
  id: string;
  externalId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  technician: {
    id: string;
    name: string;
    email: string;
  } | null;
  group: {
    id: string;
    name: string;
  } | null;
  category: string;
  subcategory: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  isServiceRequest: boolean;
  displayId: string;
  source: 'manageengine_sdp';
  rawData: object; // Original SDP data
}
```

### Assets Transformation

```typescript
{
  id: string;
  externalId: string;
  name: string;
  assetTag: string;
  serialNumber: string;
  assetType: string;
  assetState: string;
  location: string;
  department: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  vendor: string;
  product: string;
  model: string;
  warrantyExpiryDate: Date;
  acquisitionDate: Date;
  cost: number;
  salvageValue: number;
  source: 'manageengine_sdp';
  rawData: object;
}
```

## Rate Limiting

The connector implements several rate limiting strategies:

- **Request Delays**: 100ms delay between requests
- **Token Management**: Automatic token refresh before expiration
- **Error Handling**: Automatic retry on rate limit errors (429)
- **Batch Size Limits**: Maximum 100 records per request (SDP limit)

## Error Handling

Common errors and solutions:

### Authentication Errors

```
Error: OAuth authentication failed
```
**Solution**: Verify client ID, client secret, and authorization code

### Scope Errors

```
Error: Insufficient scope permissions
```
**Solution**: Ensure your OAuth scope includes the required permissions for the entity type

### Rate Limit Errors

```
Error: Rate limit exceeded
```
**Solution**: The connector automatically handles this with retries and delays

### Invalid Base URL

```
Error: Failed to connect to ManageEngine ServiceDesk Plus
```
**Solution**: Verify the base URL format and ensure it's accessible

## Best Practices

### 1. Scope Management

- Request only the scopes you need
- Use READ scopes for data extraction
- Separate scopes with commas

### 2. Batch Size Optimization

- Use smaller batch sizes (50-100) for better performance
- Larger batch sizes may hit timeout limits
- Monitor extraction performance and adjust accordingly

### 3. Date Filtering

- Use `startDate` to extract only recent data
- Format dates as ISO 8601 strings
- Consider timezone differences

### 4. Error Monitoring

- Monitor authentication token expiration
- Log extraction errors for debugging
- Implement retry logic for transient failures

### 5. Data Volume Management

- Use `maxRecords` to limit extraction size
- Implement pagination for large datasets
- Consider incremental extraction strategies

## Troubleshooting

### Token Expiration

Tokens expire after 1 hour. The connector automatically refreshes tokens, but if you encounter authentication errors:

1. Check if refresh token is available
2. Re-authenticate if refresh fails
3. Verify client credentials are correct

### Data Center Issues

If you get authentication errors, ensure you're using the correct data center:

1. Check your SDP instance URL
2. Match the data center domain
3. Use the corresponding OAuth endpoints

### API Limits

ManageEngine SDP has various limits:

- **Batch Size**: Maximum 100 records per request
- **Rate Limits**: Varies by plan and data center
- **Token Limits**: Maximum 20 refresh tokens per account

### Connection Testing

Use the test connection feature to verify setup:

```typescript
const testResult = await connector.testConnection();
if (!testResult.success) {
  console.error('Connection failed:', testResult.message);
}
```

## API Reference

### Configuration Schema

```typescript
interface ManageEngineSdpConfig {
  baseUrl: string;                    // Required: SDP instance URL
  clientId: string;                   // Required: OAuth client ID
  clientSecret: string;               // Required: OAuth client secret
  scope: string;                      // Required: OAuth scope permissions
  grantType?: 'authorization_code' | 'client_credentials';
  authorizationCode?: string;         // Required for authorization_code flow
  redirectUri?: string;               // OAuth redirect URI
  dataCenterDomain?: string;          // Zoho data center domain
}
```

### Extraction Options

```typescript
interface ExtractionOptions {
  entityType: string;                 // Entity type to extract
  batchSize?: number;                 // Records per request (max 100)
  maxRecords?: number;                // Maximum total records
  startDate?: string;                 // Filter by creation date
  endDate?: string;                   // Filter by end date
  cursor?: string;                    // Pagination cursor
  filters?: Record<string, any>;      // Additional filters
}
```

### Extraction Result

```typescript
interface ExtractedData {
  data: any[];                        // Transformed data records
  totalCount: number;                 // Total available records
  extractedCount: number;             // Actually extracted records
  hasMore: boolean;                   // More data available
  nextCursor?: string;                // Next pagination cursor
  metadata: {                         // Extraction metadata
    endpoint: string;
    dataKey: string;
    batchSize: number;
    totalBatches: number;
  };
}
```

## Support

For issues related to:

- **OAuth Setup**: Check ManageEngine SDP documentation
- **API Limits**: Contact ManageEngine support
- **Connector Issues**: Check connector logs and error messages
- **Data Transformation**: Review the transformation logic in the connector code

## Version History

- **v1.0.0**: Initial release with OAuth 2.0 support and 7 entity types 