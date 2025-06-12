import { ConnectorConfig, EntityDefinition, FieldDefinition } from '../base/ConnectorInterface';

// Configuration interface for ManageEngine SDP
export interface ManageEngineSdpConfig extends ConnectorConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  grantType?: 'authorization_code' | 'client_credentials';
  authorizationCode?: string; // Required for authorization_code flow
  redirectUri?: string;
  dataCenterDomain?: string; // e.g., 'accounts.zoho.com', 'accounts.zoho.in', etc.
}

// OAuth token response
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

// Common interfaces for SDP entities
export interface SdpTimeValue {
  display_value: string;
  value: string; // Unix timestamp as string
}

export interface SdpReference {
  id: number;
  name: string;
}

export interface SdpUser extends SdpReference {
  email_id?: string;
  phone?: string;
  mobile?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  department?: SdpReference;
  location?: SdpReference;
  is_technician?: boolean;
  is_vip_user?: boolean;
  is_deleted?: boolean;
  language?: string;
  time_zone?: string;
}

// ManageEngine SDP Request (Ticket) interface
export interface ManageEngineSdpRequest {
  id: number;
  subject: string;
  description?: string;
  status?: SdpReference;
  priority?: SdpReference;
  urgency?: SdpReference;
  impact?: SdpReference;
  requester?: SdpUser;
  technician?: SdpUser;
  group?: SdpReference;
  category?: SdpReference;
  subcategory?: SdpReference;
  item?: SdpReference;
  level?: SdpReference;
  mode?: SdpReference;
  request_type?: SdpReference;
  template?: SdpReference;
  approval_status?: SdpReference;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  due_by_time?: SdpTimeValue;
  first_response_due_by_time?: SdpTimeValue;
  resolved_time?: SdpTimeValue;
  closed_time?: SdpTimeValue;
  is_service_request?: boolean;
  is_read?: boolean;
  is_overdue?: boolean;
  is_first_response_overdue?: boolean;
  has_notes?: boolean;
  has_attachments?: boolean;
  has_linked_requests?: boolean;
  has_problem?: boolean;
  has_change?: boolean;
  has_project?: boolean;
  display_id?: string;
  email_to?: string[];
  email_cc?: string[];
  assets?: SdpReference[];
  udf_fields?: Record<string, any>; // User-defined fields
}

// ManageEngine SDP Asset interface
export interface ManageEngineSdpAsset {
  id: number;
  name: string;
  asset_tag?: string;
  serial_number?: string;
  asset_type?: SdpReference;
  asset_state?: SdpReference;
  location?: SdpReference;
  department?: SdpReference;
  user?: SdpUser;
  vendor?: SdpReference;
  product?: SdpReference;
  model?: string;
  warranty_expiry_date?: SdpTimeValue;
  acquisition_date?: SdpTimeValue;
  cost?: number;
  salvage_value?: number;
  depreciation_type?: SdpReference;
  depreciation_percentage?: number;
  description?: string;
  barcode?: string;
  po_number?: string;
  invoice_number?: string;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  udf_fields?: Record<string, any>;
}

// ManageEngine SDP User interface (extends the base SdpUser)
export interface ManageEngineSdpUser extends SdpUser {
  employee_id?: string;
  reporting_manager?: SdpUser;
  cost_per_hour?: number;
  site?: SdpReference;
  photo_url?: string;
  sms_mail?: string;
  sms_mail_id?: string;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
}

// ManageEngine SDP Problem interface
export interface ManageEngineSdpProblem {
  id: number;
  subject: string;
  description?: string;
  status?: SdpReference;
  priority?: SdpReference;
  urgency?: SdpReference;
  impact?: SdpReference;
  category?: SdpReference;
  subcategory?: SdpReference;
  technician?: SdpUser;
  group?: SdpReference;
  created_by?: SdpUser;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  due_by_time?: SdpTimeValue;
  resolved_time?: SdpTimeValue;
  closed_time?: SdpTimeValue;
  has_notes?: boolean;
  has_attachments?: boolean;
  has_linked_requests?: boolean;
  has_workarounds?: boolean;
  has_known_errors?: boolean;
  display_id?: string;
  udf_fields?: Record<string, any>;
}

// ManageEngine SDP Change interface
export interface ManageEngineSdpChange {
  id: number;
  title: string;
  description?: string;
  status?: SdpReference;
  priority?: SdpReference;
  urgency?: SdpReference;
  impact?: SdpReference;
  risk?: SdpReference;
  change_type?: SdpReference;
  category?: SdpReference;
  subcategory?: SdpReference;
  technician?: SdpUser;
  group?: SdpReference;
  created_by?: SdpUser;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  scheduled_start_time?: SdpTimeValue;
  scheduled_end_time?: SdpTimeValue;
  actual_start_time?: SdpTimeValue;
  actual_end_time?: SdpTimeValue;
  has_notes?: boolean;
  has_attachments?: boolean;
  has_linked_requests?: boolean;
  has_rollback_plan?: boolean;
  has_impact_analysis?: boolean;
  display_id?: string;
  approval_status?: SdpReference;
  udf_fields?: Record<string, any>;
}

// ManageEngine SDP Project interface
export interface ManageEngineSdpProject {
  id: number;
  title: string;
  description?: string;
  status?: SdpReference;
  priority?: SdpReference;
  project_type?: SdpReference;
  owner?: SdpUser;
  created_by?: SdpUser;
  start_date?: SdpTimeValue;
  end_date?: SdpTimeValue;
  actual_start_date?: SdpTimeValue;
  actual_end_date?: SdpTimeValue;
  percentage_completion?: number;
  cost?: number;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  has_tasks?: boolean;
  has_milestones?: boolean;
  display_id?: string;
  udf_fields?: Record<string, any>;
}

// ManageEngine SDP CMDB Configuration Item interface
export interface ManageEngineSdpCmdbItem {
  id: number;
  name: string;
  ci_type?: SdpReference;
  status?: SdpReference;
  location?: SdpReference;
  department?: SdpReference;
  vendor?: SdpReference;
  model?: string;
  serial_number?: string;
  asset_tag?: string;
  description?: string;
  created_time?: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  created_by?: SdpUser;
  last_updated_by?: SdpUser;
  udf_fields?: Record<string, any>;
}

// Entity schemas for validation and UI generation
export const MANAGEENGINE_SDP_SCHEMAS = {
  tickets: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      subject: { type: 'string', description: 'Request subject' },
      description: { type: 'string', description: 'Request description' },
      status: { type: 'object', description: 'Request status' },
      priority: { type: 'object', description: 'Request priority' },
      requester: { type: 'object', description: 'Request requester' },
      technician: { type: 'object', description: 'Assigned technician' },
      group: { type: 'object', description: 'Assigned group' },
      category: { type: 'object', description: 'Request category' },
      created_time: { type: 'object', description: 'Creation time' },
      due_by_time: { type: 'object', description: 'Due date' },
      is_service_request: { type: 'boolean', description: 'Is service request' }
    }
  },
  assets: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      name: { type: 'string', description: 'Asset name' },
      asset_tag: { type: 'string', description: 'Asset tag' },
      serial_number: { type: 'string', description: 'Serial number' },
      asset_type: { type: 'object', description: 'Asset type' },
      asset_state: { type: 'object', description: 'Asset state' },
      location: { type: 'object', description: 'Asset location' },
      user: { type: 'object', description: 'Assigned user' },
      vendor: { type: 'object', description: 'Asset vendor' },
      product: { type: 'object', description: 'Asset product' }
    }
  },
  users: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      name: { type: 'string', description: 'User name' },
      email_id: { type: 'string', description: 'Email address' },
      phone: { type: 'string', description: 'Phone number' },
      department: { type: 'object', description: 'Department' },
      location: { type: 'object', description: 'Location' },
      is_technician: { type: 'boolean', description: 'Is technician' },
      is_vip_user: { type: 'boolean', description: 'Is VIP user' }
    }
  },
  problems: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      subject: { type: 'string', description: 'Problem subject' },
      description: { type: 'string', description: 'Problem description' },
      status: { type: 'object', description: 'Problem status' },
      priority: { type: 'object', description: 'Problem priority' },
      impact: { type: 'object', description: 'Problem impact' },
      urgency: { type: 'object', description: 'Problem urgency' },
      technician: { type: 'object', description: 'Assigned technician' },
      group: { type: 'object', description: 'Assigned group' }
    }
  },
  changes: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      title: { type: 'string', description: 'Change title' },
      description: { type: 'string', description: 'Change description' },
      status: { type: 'object', description: 'Change status' },
      priority: { type: 'object', description: 'Change priority' },
      risk: { type: 'object', description: 'Change risk' },
      change_type: { type: 'object', description: 'Change type' },
      technician: { type: 'object', description: 'Assigned technician' },
      scheduled_start_time: { type: 'object', description: 'Scheduled start time' },
      scheduled_end_time: { type: 'object', description: 'Scheduled end time' }
    }
  },
  projects: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      title: { type: 'string', description: 'Project title' },
      description: { type: 'string', description: 'Project description' },
      status: { type: 'object', description: 'Project status' },
      priority: { type: 'object', description: 'Project priority' },
      project_type: { type: 'object', description: 'Project type' },
      owner: { type: 'object', description: 'Project owner' },
      start_date: { type: 'object', description: 'Start date' },
      end_date: { type: 'object', description: 'End date' },
      percentage_completion: { type: 'number', description: 'Completion percentage' }
    }
  },
  cmdb_items: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Unique identifier' },
      name: { type: 'string', description: 'CI name' },
      ci_type: { type: 'object', description: 'CI type' },
      status: { type: 'object', description: 'CI status' },
      location: { type: 'object', description: 'CI location' },
      department: { type: 'object', description: 'CI department' },
      vendor: { type: 'object', description: 'CI vendor' },
      model: { type: 'string', description: 'CI model' },
      serial_number: { type: 'string', description: 'Serial number' }
    }
  }
};

// Entity definitions for the new architecture
export const MANAGEENGINE_SDP_ENTITY_DEFINITIONS: Record<string, EntityDefinition> = {
  tickets: {
    name: 'tickets',
    displayName: 'Requests/Tickets',
    description: 'Service requests and incident tickets',
    primaryKey: 'id',
    displayField: 'subject',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'subject', type: 'string', required: true, description: 'Request subject' },
      { name: 'description', type: 'string', description: 'Request description' },
      { name: 'status', type: 'object', description: 'Request status' },
      { name: 'priority', type: 'object', description: 'Request priority' },
      { name: 'requester', type: 'object', description: 'Request requester' },
      { name: 'technician', type: 'object', description: 'Assigned technician' },
      { name: 'group', type: 'object', description: 'Assigned group' },
      { name: 'category', type: 'object', description: 'Request category' },
      { name: 'created_time', type: 'datetime', description: 'Creation time' },
      { name: 'due_by_time', type: 'datetime', description: 'Due date' },
      { name: 'is_service_request', type: 'boolean', description: 'Is service request' }
    ]
  },
  assets: {
    name: 'assets',
    displayName: 'Assets',
    description: 'IT assets and equipment',
    primaryKey: 'id',
    displayField: 'name',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'name', type: 'string', required: true, description: 'Asset name' },
      { name: 'asset_tag', type: 'string', description: 'Asset tag' },
      { name: 'serial_number', type: 'string', description: 'Serial number' },
      { name: 'asset_type', type: 'object', description: 'Asset type' },
      { name: 'asset_state', type: 'object', description: 'Asset state' },
      { name: 'location', type: 'object', description: 'Asset location' },
      { name: 'user', type: 'object', description: 'Assigned user' },
      { name: 'vendor', type: 'object', description: 'Asset vendor' },
      { name: 'product', type: 'object', description: 'Asset product' }
    ]
  },
  users: {
    name: 'users',
    displayName: 'Users',
    description: 'System users and requesters',
    primaryKey: 'id',
    displayField: 'name',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'name', type: 'string', required: true, description: 'User name' },
      { name: 'email_id', type: 'string', description: 'Email address' },
      { name: 'phone', type: 'string', description: 'Phone number' },
      { name: 'department', type: 'object', description: 'Department' },
      { name: 'location', type: 'object', description: 'Location' },
      { name: 'is_technician', type: 'boolean', description: 'Is technician' },
      { name: 'is_vip_user', type: 'boolean', description: 'Is VIP user' }
    ]
  },
  problems: {
    name: 'problems',
    displayName: 'Problems',
    description: 'Problem records',
    primaryKey: 'id',
    displayField: 'subject',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'subject', type: 'string', required: true, description: 'Problem subject' },
      { name: 'description', type: 'string', description: 'Problem description' },
      { name: 'status', type: 'object', description: 'Problem status' },
      { name: 'priority', type: 'object', description: 'Problem priority' },
      { name: 'impact', type: 'object', description: 'Problem impact' },
      { name: 'urgency', type: 'object', description: 'Problem urgency' },
      { name: 'technician', type: 'object', description: 'Assigned technician' },
      { name: 'group', type: 'object', description: 'Assigned group' }
    ]
  },
  changes: {
    name: 'changes',
    displayName: 'Changes',
    description: 'Change requests',
    primaryKey: 'id',
    displayField: 'title',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'title', type: 'string', required: true, description: 'Change title' },
      { name: 'description', type: 'string', description: 'Change description' },
      { name: 'status', type: 'object', description: 'Change status' },
      { name: 'priority', type: 'object', description: 'Change priority' },
      { name: 'risk', type: 'object', description: 'Change risk' },
      { name: 'change_type', type: 'object', description: 'Change type' },
      { name: 'technician', type: 'object', description: 'Assigned technician' },
      { name: 'scheduled_start_time', type: 'datetime', description: 'Scheduled start time' },
      { name: 'scheduled_end_time', type: 'datetime', description: 'Scheduled end time' }
    ]
  },
  projects: {
    name: 'projects',
    displayName: 'Projects',
    description: 'Project records',
    primaryKey: 'id',
    displayField: 'title',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'title', type: 'string', required: true, description: 'Project title' },
      { name: 'description', type: 'string', description: 'Project description' },
      { name: 'status', type: 'object', description: 'Project status' },
      { name: 'priority', type: 'object', description: 'Project priority' },
      { name: 'project_type', type: 'object', description: 'Project type' },
      { name: 'owner', type: 'object', description: 'Project owner' },
      { name: 'start_date', type: 'datetime', description: 'Start date' },
      { name: 'end_date', type: 'datetime', description: 'End date' },
      { name: 'percentage_completion', type: 'number', description: 'Completion percentage' }
    ]
  },
  cmdb_items: {
    name: 'cmdb_items',
    displayName: 'CMDB Items',
    description: 'Configuration Management Database items',
    primaryKey: 'id',
    displayField: 'name',
    fields: [
      { name: 'id', type: 'number', required: true, description: 'Unique identifier' },
      { name: 'name', type: 'string', required: true, description: 'CI name' },
      { name: 'ci_type', type: 'object', description: 'CI type' },
      { name: 'status', type: 'object', description: 'CI status' },
      { name: 'location', type: 'object', description: 'CI location' },
      { name: 'department', type: 'object', description: 'CI department' },
      { name: 'vendor', type: 'object', description: 'CI vendor' },
      { name: 'model', type: 'string', description: 'CI model' },
      { name: 'serial_number', type: 'string', description: 'Serial number' }
    ]
  }
}; 