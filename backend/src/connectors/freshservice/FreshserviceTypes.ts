export interface FreshserviceConfig {
  domain: string;
  apiKey: string;
  baseUrl?: string;
}

export interface FreshserviceTicket {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: number;
  priority: number;
  type: string;
  source: number;
  requester_id: number;
  responder_id?: number;
  group_id?: number;
  department_id?: number;
  category?: string;
  sub_category?: string;
  item_category?: string;
  created_at: string;
  updated_at: string;
  due_by?: string;
  fr_due_by?: string;
  fr_escalated: boolean;
  spam: boolean;
  email_config_id?: number;
  custom_fields: Record<string, any>;
  tags: string[];
  attachments: FreshserviceAttachment[];
  
  // Additional fields available from detail API
  cc_emails?: string[];
  fwd_emails?: string[];
  reply_cc_emails?: string[];
  to_emails?: string[];
  sla_policy_id?: number;
  is_escalated?: boolean;
  urgency?: number;
  impact?: number;
  deleted?: boolean;
  resolution_notes?: string;
  resolution_notes_html?: string;
  workspace_id?: number;
  created_within_business_hours?: boolean;
  approval_status?: number;
  approval_status_name?: string;
  
  // Fields populated with include parameters
  conversations?: FreshserviceConversation[];  // Available with include=conversations
  requester?: FreshserviceUser;                // Available with include=requester
  requested_for?: FreshserviceUser;            // Available with include=requested_for
  stats?: FreshserviceTicketStats;             // Available with include=stats
  problem?: any;                               // Available with include=problem
  assets?: FreshserviceAsset[];               // Available with include=assets
  changes?: any[];                            // Available with include=changes
  related_tickets?: any;                      // Available with include=related_tickets
  onboarding_context?: any;                   // Available with include=onboarding_context
  offboarding_context?: any;                  // Available with include=offboarding_context
}

export interface FreshserviceAsset {
  id: number;
  display_id: number;
  name: string;
  description?: string;
  asset_type_id: number;
  impact: string;
  usage_type: string;
  asset_tag?: string;
  user_id?: number;
  location_id?: number;
  department_id?: number;
  agent_id?: number;
  group_id?: number;
  assigned_on?: string;
  created_at: string;
  updated_at: string;
  author_type: string;
  level_field_attributes: Record<string, any>;
  type_fields: Record<string, any>;
}

export interface FreshserviceUser {
  id: number;
  first_name: string;
  last_name: string;
  occasional: boolean;
  job_title?: string;
  email: string;
  work_phone_number?: string;
  mobile_phone_number?: string;
  department_id?: number;
  can_see_all_tickets_from_associated_departments: boolean;
  reporting_manager_id?: number;
  address?: string;
  time_zone: string;
  time_format: string;
  language: string;
  location_id?: number;
  background_information?: string;
  scoreboard_level_id?: number;
  member_of: number[];
  observer_of: number[];
  roles: FreshserviceRole[];
  signature?: string;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
  has_logged_in: boolean;
  active: boolean;
  deleted: boolean;
  vip_user: boolean;
  external_id?: string;
  principal_name?: string;
}

export interface FreshserviceGroup {
  id: number;
  name: string;
  description?: string;
  escalate_to?: number;
  unassigned_for?: string;
  agent_ids: number[];
  members: number[];
  observers: number[];
  restricted: boolean;
  approval_required: boolean;
  auto_ticket_assign: boolean;
  created_at: string;
  updated_at: string;
}

export interface FreshserviceRole {
  role_id: number;
  assignment_scope: string;
  groups: number[];
}

export interface FreshserviceAttachment {
  id: number;
  content_type: string;
  size: number;
  name: string;
  attachment_url: string;
  created_at: string;
  updated_at: string;
}

export interface FreshserviceConversation {
  id: number;
  user_id: number;
  to_emails?: string[];
  from_email?: string;
  cc_emails?: string[];
  bcc_emails?: string[];
  body: string;
  body_text: string;
  incoming: boolean;
  private: boolean;
  source: number;
  created_at: string;
  updated_at: string;
  attachments?: FreshserviceAttachment[];
}

export interface FreshserviceTicketStats {
  agent_responded_at?: string;
  requester_responded_at?: string;
  first_responded_at?: string;
  status_updated_at?: string;
  reopened_at?: string;
  resolved_at?: string;
  closed_at?: string;
  pending_since?: string;
}

export interface FreshservicePaginationInfo {
  total: number;
  per_page: number;
  page: number;
}

// Specific response types for each entity
export interface FreshserviceTicketsResponse extends FreshservicePaginationInfo {
  tickets: FreshserviceTicket[];
}

export interface FreshserviceAssetsResponse extends FreshservicePaginationInfo {
  assets: FreshserviceAsset[];
}

export interface FreshserviceUsersResponse extends FreshservicePaginationInfo {
  requesters: FreshserviceUser[];
}

export interface FreshserviceGroupsResponse extends FreshservicePaginationInfo {
  groups: FreshserviceGroup[];
}

// Status mappings
export const FRESHSERVICE_TICKET_STATUS = {
  2: 'Open',
  3: 'Pending',
  4: 'Resolved',
  5: 'Closed'
} as const;

export const FRESHSERVICE_TICKET_PRIORITY = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent'
} as const;

export const FRESHSERVICE_TICKET_SOURCE = {
  1: 'Email',
  2: 'Portal',
  3: 'Phone',
  4: 'Chat',
  5: 'Feedback Widget',
  6: 'Yammer',
  7: 'AWS Cloudwatch',
  8: 'Pagerduty',
  9: 'Walkup',
  10: 'Slack'
} as const;

// Entity schemas for validation and transformation
export const FRESHSERVICE_SCHEMAS = {
  tickets: {
    id: 'number',
    subject: 'string',
    description: 'string',
    status: 'number',
    priority: 'number',
    type: 'string',
    source: 'number',
    requester_id: 'number',
    created_at: 'string',
    updated_at: 'string'
  },
  assets: {
    id: 'number',
    display_id: 'number',
    name: 'string',
    asset_type_id: 'number',
    impact: 'string',
    usage_type: 'string',
    created_at: 'string',
    updated_at: 'string'
  },
  users: {
    id: 'number',
    first_name: 'string',
    last_name: 'string',
    email: 'string',
    active: 'boolean',
    created_at: 'string',
    updated_at: 'string'
  },
  groups: {
    id: 'number',
    name: 'string',
    agent_ids: 'array',
    created_at: 'string',
    updated_at: 'string'
  }
} as const;

// Entity definitions following the new architecture
import { EntityDefinition, EntityType } from '../base/ConnectorInterface';

export const FRESHSERVICE_ENTITY_DEFINITIONS: Record<EntityType, EntityDefinition> = {
  [EntityType.TICKETS]: {
    name: 'Tickets',
    type: EntityType.TICKETS,
    
    // Extraction configuration
    extraction: {
      endpoint: '/api/v2/tickets',
      method: 'GET',
      detailEndpoint: '/api/v2/tickets/{id}',
      detailRequired: true,
      fields: {
        id: { type: 'number', required: true, readOnly: true },
        subject: { type: 'string', required: true },
        description: { type: 'string', required: false },        // ⚠️ Only available via detail API
        description_text: { type: 'string', required: false, readOnly: true },  // ⚠️ Only available via detail API
        status: { type: 'number', required: true },
        priority: { type: 'number', required: true },
        type: { type: 'string', required: false },
        source: { type: 'number', required: false },
        requester_id: { type: 'number', required: true },
        responder_id: { type: 'number', required: false },
        group_id: { type: 'number', required: false },
        department_id: { type: 'number', required: false },
        category: { type: 'string', required: false },
        sub_category: { type: 'string', required: false },
        created_at: { type: 'date', required: true, readOnly: true },
        updated_at: { type: 'date', required: true, readOnly: true },
        due_by: { type: 'date', required: false },
        custom_fields: { type: 'object', required: false },     // ⚠️ Complete data only via detail API
        tags: { type: 'array', required: false },               // ⚠️ Only available via detail API with include=tags
        attachments: { type: 'array', required: false },        // ⚠️ Only available via detail API
        conversations: { type: 'array', required: false },      // ⚠️ Only available via detail API with include=conversations
        resolution_notes: { type: 'string', required: false },  // ⚠️ Only available via detail API
        resolution_notes_html: { type: 'string', required: false } // ⚠️ Only available via detail API
      },
      pagination: {
        type: 'page',
        param: 'page'
      }
    },
    
    // Loading configuration
    loading: {
      endpoint: '/api/v2/tickets',
      method: 'POST',
      fields: {
        subject: { type: 'string', required: true },
        description: { type: 'string', required: false },
        status: { type: 'number', required: true },
        priority: { type: 'number', required: true },
        type: { type: 'string', required: false },
        source: { type: 'number', required: false },
        requester_id: { type: 'number', required: true },
        responder_id: { type: 'number', required: false },
        group_id: { type: 'number', required: false },
        department_id: { type: 'number', required: false },
        category: { type: 'string', required: false },
        sub_category: { type: 'string', required: false },
        due_by: { type: 'date', required: false },
        custom_fields: { type: 'object', required: false },
        tags: { type: 'array', required: false }
      },
      requiredFields: ['subject', 'status', 'priority', 'requester_id'],
      validation: {
        status: {
          type: 'enum',
          value: [2, 3, 4, 5, 6], // Valid status values for creation
          message: 'Invalid status value for ticket creation'
        },
        priority: {
          type: 'enum',
          value: [1, 2, 3, 4], // Valid priority values
          message: 'Invalid priority value'
        }
      }
    }
  },

  [EntityType.ASSETS]: {
    name: 'Assets',
    type: EntityType.ASSETS,
    
    // Extraction configuration
    extraction: {
      endpoint: '/api/v2/assets',
      method: 'GET',
      fields: {
        id: { type: 'number', required: true, readOnly: true },
        display_id: { type: 'number', required: true, readOnly: true },
        name: { type: 'string', required: true },
        description: { type: 'string', required: false },
        asset_type_id: { type: 'number', required: true },
        impact: { type: 'string', required: false },
        usage_type: { type: 'string', required: false },
        asset_tag: { type: 'string', required: false },
        user_id: { type: 'number', required: false },
        location_id: { type: 'number', required: false },
        department_id: { type: 'number', required: false },
        agent_id: { type: 'number', required: false },
        group_id: { type: 'number', required: false },
        assigned_on: { type: 'date', required: false },
        created_at: { type: 'date', required: true, readOnly: true },
        updated_at: { type: 'date', required: true, readOnly: true },
        type_fields: { type: 'object', required: false }
      },
      pagination: {
        type: 'page',
        param: 'page'
      }
    },
    
    // Loading configuration
    loading: {
      endpoint: '/api/v2/assets',
      method: 'POST',
      fields: {
        name: { type: 'string', required: true },
        description: { type: 'string', required: false },
        asset_type_id: { type: 'number', required: true },
        impact: { type: 'string', required: false },
        usage_type: { type: 'string', required: false },
        asset_tag: { type: 'string', required: false },
        user_id: { type: 'number', required: false },
        location_id: { type: 'number', required: false },
        department_id: { type: 'number', required: false },
        agent_id: { type: 'number', required: false },
        group_id: { type: 'number', required: false },
        type_fields: { type: 'object', required: false }
      },
      requiredFields: ['name', 'asset_type_id']
    }
  },

  [EntityType.USERS]: {
    name: 'Users',
    type: EntityType.USERS,
    
    // Extraction configuration
    extraction: {
      endpoint: '/api/v2/requesters',
      method: 'GET',
      fields: {
        id: { type: 'number', required: true, readOnly: true },
        first_name: { type: 'string', required: true },
        last_name: { type: 'string', required: false },
        email: { type: 'string', required: true },
        job_title: { type: 'string', required: false },
        work_phone_number: { type: 'string', required: false },
        mobile_phone_number: { type: 'string', required: false },
        department_id: { type: 'number', required: false },
        reporting_manager_id: { type: 'number', required: false },
        address: { type: 'string', required: false },
        time_zone: { type: 'string', required: false },
        language: { type: 'string', required: false },
        location_id: { type: 'number', required: false },
        active: { type: 'boolean', required: true },
        vip_user: { type: 'boolean', required: false },
        created_at: { type: 'date', required: true, readOnly: true },
        updated_at: { type: 'date', required: true, readOnly: true },
        has_logged_in: { type: 'boolean', required: false, readOnly: true },
        roles: { type: 'array', required: false },
        custom_fields: { type: 'object', required: false }
      },
      pagination: {
        type: 'page',
        param: 'page'
      }
    },
    
    // Loading configuration
    loading: {
      endpoint: '/api/v2/requesters',
      method: 'POST',
      fields: {
        first_name: { type: 'string', required: true },
        last_name: { type: 'string', required: false },
        email: { type: 'string', required: true },
        job_title: { type: 'string', required: false },
        work_phone_number: { type: 'string', required: false },
        mobile_phone_number: { type: 'string', required: false },
        department_id: { type: 'number', required: false },
        reporting_manager_id: { type: 'number', required: false },
        address: { type: 'string', required: false },
        time_zone: { type: 'string', required: false },
        language: { type: 'string', required: false },
        location_id: { type: 'number', required: false },
        active: { type: 'boolean', required: false },
        vip_user: { type: 'boolean', required: false },
        custom_fields: { type: 'object', required: false }
      },
      requiredFields: ['first_name', 'email'],
      validation: {
        email: {
          type: 'regex',
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'Invalid email format'
        }
      }
    }
  },

  [EntityType.GROUPS]: {
    name: 'Groups',
    type: EntityType.GROUPS,
    
    // Extraction configuration
    extraction: {
      endpoint: '/api/v2/groups',
      method: 'GET',
      fields: {
        id: { type: 'number', required: true, readOnly: true },
        name: { type: 'string', required: true },
        description: { type: 'string', required: false },
        escalate_to: { type: 'number', required: false },
        agent_ids: { type: 'array', required: false },
        members: { type: 'array', required: false },
        observers: { type: 'array', required: false },
        restricted: { type: 'boolean', required: false },
        approval_required: { type: 'boolean', required: false },
        auto_ticket_assign: { type: 'boolean', required: false },
        created_at: { type: 'date', required: true, readOnly: true },
        updated_at: { type: 'date', required: true, readOnly: true }
      },
      pagination: {
        type: 'page',
        param: 'page'
      }
    },
    
    // Loading configuration
    loading: {
      endpoint: '/api/v2/groups',
      method: 'POST',
      fields: {
        name: { type: 'string', required: true },
        description: { type: 'string', required: false },
        escalate_to: { type: 'number', required: false },
        agent_ids: { type: 'array', required: false },
        restricted: { type: 'boolean', required: false },
        approval_required: { type: 'boolean', required: false },
        auto_ticket_assign: { type: 'boolean', required: false }
      },
      requiredFields: ['name']
    }
  },

  // Placeholder definitions for other entity types (not implemented yet)
  [EntityType.INCIDENTS]: {
    name: 'Incidents',
    type: EntityType.INCIDENTS,
    extraction: {
      endpoint: '/api/v2/tickets',
      method: 'GET',
      fields: {}
    },
    loading: {
      endpoint: '/api/v2/tickets',
      method: 'POST',
      fields: {},
      requiredFields: []
    }
  },

  [EntityType.CHANGES]: {
    name: 'Changes',
    type: EntityType.CHANGES,
    extraction: {
      endpoint: '/api/v2/changes',
      method: 'GET',
      fields: {}
    },
    loading: {
      endpoint: '/api/v2/changes',
      method: 'POST',
      fields: {},
      requiredFields: []
    }
  },

  [EntityType.PROBLEMS]: {
    name: 'Problems',
    type: EntityType.PROBLEMS,
    extraction: {
      endpoint: '/api/v2/problems',
      method: 'GET',
      fields: {}
    },
    loading: {
      endpoint: '/api/v2/problems',
      method: 'POST',
      fields: {},
      requiredFields: []
    }
  },

  [EntityType.RELEASES]: {
    name: 'Releases',
    type: EntityType.RELEASES,
    extraction: {
      endpoint: '/api/v2/releases',
      method: 'GET',
      fields: {}
    },
    loading: {
      endpoint: '/api/v2/releases',
      method: 'POST',
      fields: {},
      requiredFields: []
    }
  }
}; 