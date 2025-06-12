# Freshservice Connector Documentation

## Overview

The Freshservice connector enables bidirectional data integration with Freshservice IT Service Management platform. It supports both data extraction (pulling data from Freshservice) and data loading (pushing data to Freshservice) using Freshservice's REST API v2.

## Features

- **Authentication**: API Key-based authentication
- **Bidirectional Operations**: Extract and load data
- **Entity Support**: Tickets, Assets, Users, Groups
- **Pagination**: Automatic handling of paginated responses
- **Rate Limiting**: Built-in rate limiting to respect API limits
- **Detail Extraction**: Optional detailed data extraction for tickets
- **Date Filtering**: Support for incremental data extraction
- **Progress Tracking**: Real-time progress updates during extraction
- **Batch Processing**: Configurable batch sizes for optimal performance

## Supported Entities

| Entity Type | Extract | Load | Description |
|-------------|---------|------|-------------|
| **Tickets** | ✅ | ✅ | Service requests, incidents, and tickets |
| **Assets** | ✅ | ✅ | IT assets and configuration items |
| **Users** | ✅ | ✅ | Requesters and agents |
| **Groups** | ✅ | ✅ | Agent groups and departments |

## Configuration

### Basic Configuration

```typescript
interface FreshserviceConfig {
  domain: string;      // Your Freshservice domain (e.g., 'yourcompany')
  apiKey: string;      // Freshservice API key
  baseUrl?: string;    // Optional: Custom base URL
}
```

### Example Configuration

```json
{
  "type": "FRESHSERVICE",
  "domain": "yourcompany",
  "apiKey": "your-api-key-here"
}
```

## Authentication Setup

### 1. Generate API Key

1. Log in to your Freshservice account
2. Go to **Admin** → **API Settings**
3. Click **Generate New API Key**
4. Copy the generated API key
5. Store it securely for connector configuration

### 2. API Key Format

Freshservice uses Basic Authentication with the API key:
- **Username**: Your API key
- **Password**: 'X' (literal character X)
- **Format**: `Basic base64(apiKey:X)`

### 3. Required Permissions

Ensure your API key has the following permissions:
- **Tickets**: Read/Write access to tickets
- **Assets**: Read/Write access to assets  
- **Users**: Read/Write access to requesters and agents
- **Groups**: Read/Write access to groups

## API Reference

### Base URL Structure
```
https://{domain}.freshservice.com/api/v2
```

### Authentication Headers
```http
Authorization: Basic {base64(apiKey:X)}
Content-Type: application/json
User-Agent: Project-Bridge/1.0
```

### Rate Limiting
- **Default Rate Limit**: 1000 requests per hour
- **Burst Limit**: 100 requests per minute
- **Connector Handling**: Automatic rate limiting with exponential backoff

## Entity Details

### Tickets

**Extraction Endpoint**: `/api/v2/tickets`
**Loading Endpoint**: `/api/v2/tickets`

#### Key Fields
- `id`: Unique ticket identifier
- `subject`: Ticket subject/title
- `description`: Ticket description (HTML)
- `description_text`: Ticket description (plain text)
- `status`: Ticket status (2=Open, 3=Pending, 4=Resolved, 5=Closed)
- `priority`: Priority level (1=Low, 2=Medium, 3=High, 4=Urgent)
- `requester_id`: ID of the person who created the ticket
- `group_id`: Assigned group ID
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

#### Detail Extraction
The connector supports detailed ticket extraction with additional data:
- **Conversations**: Ticket replies and notes
- **Requester Info**: Full requester details
- **Stats**: Response and resolution times
- **Assets**: Associated assets
- **Custom Fields**: Custom field values

#### Status Values
```typescript
enum TicketStatus {
  OPEN = 2,
  PENDING = 3,
  RESOLVED = 4,
  CLOSED = 5,
  WAITING_ON_CUSTOMER = 6,
  WAITING_ON_THIRD_PARTY = 7
}
```

#### Priority Values
```typescript
enum TicketPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4
}
```

### Assets

**Extraction Endpoint**: `/api/v2/assets`
**Loading Endpoint**: `/api/v2/assets`

#### Key Fields
- `id`: Unique asset identifier
- `display_id`: Human-readable asset ID
- `name`: Asset name
- `asset_type_id`: Asset type identifier
- `impact`: Business impact level
- `usage_type`: How the asset is used
- `user_id`: Assigned user ID
- `location_id`: Asset location
- `department_id`: Owning department

### Users

**Extraction Endpoint**: `/api/v2/requesters`
**Loading Endpoint**: `/api/v2/requesters`

#### Key Fields
- `id`: Unique user identifier
- `first_name`: User's first name
- `last_name`: User's last name
- `email`: Email address
- `active`: Whether user is active
- `job_title`: Job title
- `department_id`: Department ID
- `time_zone`: User's timezone
- `language`: Preferred language

### Groups

**Extraction Endpoint**: `/api/v2/groups`
**Loading Endpoint**: `/api/v2/groups`

#### Key Fields
- `id`: Unique group identifier
- `name`: Group name
- `description`: Group description
- `agent_ids`: List of agent IDs in the group
- `restricted`: Whether group is restricted
- `auto_ticket_assign`: Auto-assignment setting

## Data Transformation

### Extraction Transformation

The connector transforms Freshservice data to a standardized format:

```typescript
// Freshservice Ticket → Standardized Format
{
  id: ticket.id,
  title: ticket.subject,
  description: ticket.description_text,
  status: this.mapTicketStatus(ticket.status),
  priority: this.mapTicketPriority(ticket.priority),
  created_at: ticket.created_at,
  updated_at: ticket.updated_at,
  assignee: ticket.responder_id,
  requester: ticket.requester_id,
  group: ticket.group_id,
  // Preserve original data
  _raw: ticket
}
```

### Loading Transformation

For loading data to Freshservice:

```typescript
// Standardized Format → Freshservice Ticket
{
  subject: data.title,
  description: data.description,
  status: this.mapToFreshserviceStatus(data.status),
  priority: this.mapToFreshservicePriority(data.priority),
  requester_id: data.requester,
  group_id: data.group,
  type: data.type || 'Incident'
}
```

## Usage Examples

### Basic Extraction

```typescript
const connector = new FreshserviceConnector({
  domain: 'yourcompany',
  apiKey: 'your-api-key'
});

// Extract tickets
const result = await connector.extractData({
  entityType: EntityType.TICKETS,
  maxRecords: 1000,
  batchSize: 100
});
```

### Date-Filtered Extraction

```typescript
// Extract tickets updated since specific date
const result = await connector.extractData({
  entityType: EntityType.TICKETS,
  startDate: '2024-01-01T00:00:00Z',
  maxRecords: 500
});
```

### Detailed Ticket Extraction

```typescript
// Extract tickets with full details
const result = await connector.extractData({
  entityType: EntityType.TICKETS,
  includeDetails: true,
  detailFields: ['conversations', 'requester', 'stats']
});
```

### Loading Data

```typescript
// Load tickets to Freshservice
const loadResult = await connector.loadData({
  entityType: EntityType.TICKETS,
  batchSize: 50
}, ticketData);
```

### Progress Tracking

```typescript
// Extract with progress callback
const result = await connector.extractDataWithProgress({
  entityType: EntityType.TICKETS,
  maxRecords: 1000
}, async (current, total, phase) => {
  console.log(`Progress: ${current}/${total} (${phase})`);
});
```

## Configuration Options

### Extraction Options

```typescript
interface ExtractionOptions {
  entityType: EntityType;
  maxRecords?: number;        // Maximum records to extract
  batchSize?: number;         // Records per API call (default: 100)
  startDate?: string;         // Filter by update date
  endDate?: string;           // End date filter
  cursor?: string;            // Pagination cursor
  includeDetails?: boolean;   // Extract detailed data
  detailFields?: string[];    // Specific detail fields
  filters?: Record<string, any>; // Custom filters
}
```

### Loading Options

```typescript
interface LoadOptions {
  entityType: EntityType;
  batchSize?: number;         // Records per batch (default: 50)
  validateOnly?: boolean;     // Validate without loading
  updateExisting?: boolean;   // Update existing records
  skipDuplicates?: boolean;   // Skip duplicate records
}
```

## Error Handling

### Common Error Scenarios

1. **Authentication Errors**
   ```typescript
   // Invalid API key
   {
     success: false,
     message: "Authentication failed",
     details: { error: "Invalid API key" }
   }
   ```

2. **Rate Limit Errors**
   ```typescript
   // Rate limit exceeded
   {
     success: false,
     message: "Rate limit exceeded",
     details: { retryAfter: 3600 }
   }
   ```

3. **Validation Errors**
   ```typescript
   // Missing required fields
   {
     success: false,
     errors: [
       {
         record: 1,
         field: "subject",
         message: "Subject is required"
       }
     ]
   }
   ```

### Error Recovery

The connector implements automatic error recovery:
- **Exponential Backoff**: For rate limit errors
- **Retry Logic**: For transient network errors
- **Partial Success**: Continue processing after individual record failures
- **Detailed Logging**: Comprehensive error logging for debugging

## Performance Optimization

### Batch Size Recommendations

| Entity Type | Recommended Batch Size | Max Batch Size |
|-------------|----------------------|----------------|
| Tickets | 100 | 100 |
| Assets | 100 | 100 |
| Users | 100 | 100 |
| Groups | 100 | 100 |

### Detail Extraction Performance

- **Standard Extraction**: ~100 records/minute
- **Detailed Extraction**: ~20 records/minute (due to additional API calls)
- **Recommendation**: Use detailed extraction only when necessary

### Memory Usage

- **Standard Mode**: ~1MB per 1000 records
- **Detailed Mode**: ~5MB per 1000 records
- **Recommendation**: Process in batches for large datasets

## Troubleshooting

### Connection Issues

1. **Verify Domain**
   ```bash
   curl -I https://yourcompany.freshservice.com/api/v2/tickets
   ```

2. **Test API Key**
   ```bash
   curl -u "your-api-key:X" https://yourcompany.freshservice.com/api/v2/agents/me
   ```

3. **Check SSL/TLS**
   - Connector uses TLS 1.2
   - Verify certificate validity

### Data Issues

1. **Missing Records**
   - Check date filters
   - Verify pagination settings
   - Review API permissions

2. **Transformation Errors**
   - Check field mappings
   - Verify data types
   - Review custom field handling

3. **Loading Failures**
   - Validate required fields
   - Check field value constraints
   - Verify user permissions

### Performance Issues

1. **Slow Extraction**
   - Reduce batch size
   - Disable detailed extraction
   - Check network connectivity

2. **Rate Limiting**
   - Increase delay between requests
   - Reduce concurrent operations
   - Monitor API usage

## Best Practices

### Security
- Store API keys securely (environment variables, key vaults)
- Use least-privilege API permissions
- Regularly rotate API keys
- Monitor API usage for anomalies

### Performance
- Use appropriate batch sizes for your data volume
- Implement incremental extraction using date filters
- Monitor memory usage for large datasets
- Use detailed extraction sparingly

### Data Quality
- Validate data before loading
- Handle custom fields appropriately
- Preserve original data for troubleshooting
- Implement data reconciliation checks

### Monitoring
- Log all API interactions
- Monitor extraction/loading success rates
- Track performance metrics
- Set up alerts for failures

## API Limits and Quotas

### Rate Limits
- **Standard Plan**: 1000 requests/hour
- **Pro Plan**: 2000 requests/hour
- **Enterprise Plan**: 5000 requests/hour

### Data Limits
- **Max Records per Request**: 100
- **Max File Upload Size**: 15MB
- **Max Custom Fields**: 50 per entity

### Recommendations
- Monitor your API usage in Freshservice admin panel
- Implement caching for reference data
- Use webhooks for real-time updates when possible
- Consider API limits when scheduling extraction jobs

## Support and Resources

### Freshservice API Documentation
- [Freshservice API v2 Documentation](https://api.freshservice.com/)
- [Authentication Guide](https://api.freshservice.com/#authentication)
- [Rate Limiting](https://api.freshservice.com/#rate_limiting)

### Connector Support
- Check connector logs for detailed error information
- Use test connection feature to verify configuration
- Monitor API usage to avoid rate limits
- Contact support with specific error messages and logs 