/**
 * MCP Tool definitions for FogBugz operations
 */

// Define the Tool interface since we're having trouble importing it
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Tool: Create a new FogBugz case
export const createCaseTool: Tool = {
  name: 'fogbugz_create_case',
  description: 'Creates a new FogBugz case with optional screenshot attachments.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title or summary of the issue',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the issue',
        optional: true,
      },
      project: {
        type: 'string',
        description: 'Project name where the case should be created',
        optional: true,
      },
      area: {
        type: 'string',
        description: 'Area name within the project',
        optional: true,
      },
      milestone: {
        type: 'string',
        description: 'Milestone (FixFor) name',
        optional: true,
      },
      priority: {
        type: ['number', 'string'],
        description: 'Priority level (number 1-7) or name',
        optional: true,
      },
      assignee: {
        type: 'string',
        description: 'Person to assign the case to',
        optional: true,
      },
      attachmentPath: {
        type: 'string',
        description: 'Path to a screenshot or file to attach',
        optional: true,
      },
    },
    required: ['title'],
  },
};

// Tool: Update an existing FogBugz case
export const updateCaseTool: Tool = {
  name: 'fogbugz_update_case',
  description: 'Updates an existing FogBugz case with new field values.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to update',
      },
      title: {
        type: 'string',
        description: 'New title for the case',
        optional: true,
      },
      description: {
        type: 'string',
        description: 'Additional comment to add to the case',
        optional: true,
      },
      project: {
        type: 'string',
        description: 'Project to move the case to',
        optional: true,
      },
      area: {
        type: 'string',
        description: 'Area within the project',
        optional: true,
      },
      milestone: {
        type: 'string',
        description: 'Milestone (FixFor) name',
        optional: true,
      },
      priority: {
        type: ['number', 'string'],
        description: 'Priority level (number 1-7) or name',
        optional: true,
      },
      assignee: {
        type: 'string',
        description: 'Name or email of the person to assign the case to',
        optional: true,
      },
      tags: {
        type: ['array', 'string'],
        description: 'Tags for the case, as an array or comma-delimited string',
        optional: true,
      },
      dueDate: {
        type: 'string',
        description: 'Due date in ISO 8601 format (e.g. "2026-09-01T00:00:00Z")',
        optional: true,
      },
      estimate: {
        type: 'number',
        description:
          'Current time estimate, in hours. Instances with time tracking disabled ' +
          'accept this and ignore it; the response reports a warning when that happens.',
        optional: true,
      },
      parentCaseId: {
        type: 'number',
        description: 'Parent case ID, to make this a subcase',
        optional: true,
      },
      attachmentPath: {
        type: 'string',
        description: 'Path to a screenshot or file to attach',
        optional: true,
      },
    },
    required: ['caseId'],
  },
};

// Tool: Add a comment to a case without touching other fields
export const addCommentTool: Tool = {
  name: 'fogbugz_add_comment',
  description:
    'Adds a comment to an existing FogBugz case without changing any other field.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to comment on',
      },
      comment: {
        type: 'string',
        description: 'The comment text to add to the case',
      },
      attachmentPath: {
        type: 'string',
        description: 'Path to a screenshot or file to attach to the comment',
        optional: true,
      },
    },
    required: ['caseId', 'comment'],
  },
};

// Tool: Resolve a case
export const resolveCaseTool: Tool = {
  name: 'fogbugz_resolve_case',
  description:
    'Resolves a FogBugz case. Note that resolving does not close a case -- ' +
    'use fogbugz_close_case afterwards to close it.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to resolve',
      },
      status: {
        type: ['string', 'number'],
        description:
          'Resolved status, either a name like "Resolved (Fixed)" or a numeric ' +
          'ixStatus. Omit to use the default resolved status. Call ' +
          'fogbugz_list_metadata with entity="statuses" to see the options.',
        optional: true,
      },
      comment: {
        type: 'string',
        description: 'Comment explaining the resolution',
        optional: true,
      },
    },
    required: ['caseId'],
  },
};

// Tool: Close a case
export const closeCaseTool: Tool = {
  name: 'fogbugz_close_case',
  description:
    'Closes a FogBugz case. A case must normally be resolved before it can be closed.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to close',
      },
      comment: {
        type: 'string',
        description: 'Comment explaining why the case is being closed',
        optional: true,
      },
    },
    required: ['caseId'],
  },
};

// Tool: Reopen a case
export const reopenCaseTool: Tool = {
  name: 'fogbugz_reopen_case',
  description: 'Reopens a resolved or closed FogBugz case.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to reopen',
      },
      comment: {
        type: 'string',
        description: 'Comment explaining why the case is being reopened',
        optional: true,
      },
    },
    required: ['caseId'],
  },
};

// Tool: Assign a FogBugz case to a user
export const assignCaseTool: Tool = {
  name: 'fogbugz_assign_case',
  description: 'Assigns a FogBugz case to a specific user.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to assign',
      },
      assignee: {
        type: 'string',
        description: 'Name or email of the person to assign the case to',
      },
    },
    required: ['caseId', 'assignee'],
  },
};

// Shared guidance for the `cols` parameter. FogBugz drops unrecognized column
// names without erroring, so the server validates them before sending.
const COLS_DESCRIPTION =
  'Optional list of FogBugz column names to return, e.g. ["ixBug","sTitle","dtLastUpdated"]. ' +
  'Defaults to a broad set. Unknown names are rejected with the list of valid ones. ' +
  'Use "events" to pull the full comment history.';

// Tool: Get a single case in full detail
export const getCaseTool: Tool = {
  name: 'fogbugz_get_case',
  description:
    'Gets a single FogBugz case with full metadata and, by default, its complete ' +
    'event history (description, comments, field changes, and assignments). ' +
    'Use this to understand the context and discussion on a case.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to fetch',
      },
      cols: {
        type: 'array',
        description: COLS_DESCRIPTION,
        optional: true,
      },
      includeEvents: {
        type: 'boolean',
        description:
          'Whether to include the full event history (default: true). Set false for ' +
          'a metadata-only response on a case with a very long thread.',
        optional: true,
      },
    },
    required: ['caseId'],
  },
};

// Tool: List cases assigned to a user
export const listUserCasesTool: Tool = {
  name: 'fogbugz_list_my_cases',
  description: 'Lists FogBugz cases assigned to a specific user.',
  inputSchema: {
    type: 'object',
    properties: {
      assignee: {
        type: 'string',
        description: 'Name or email of the person whose cases to list (defaults to current user if empty)',
        optional: true,
      },
      status: {
        type: 'string',
        description: 'Filter by status (e.g., "active", "closed")',
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of cases to return',
        optional: true,
      },
      cols: {
        type: 'array',
        description: COLS_DESCRIPTION,
        optional: true,
      },
    },
    required: [],
  },
};

// Tool: Search for cases in FogBugz
export const searchCasesTool: Tool = {
  name: 'fogbugz_search_cases',
  description: 'Searches for FogBugz cases based on a query string. Supports FogBugz search syntax.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string. Supports FogBugz search syntax (e.g., "project:Website status:Active")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of cases to return',
        optional: true,
      },
      cols: {
        type: 'array',
        description: COLS_DESCRIPTION,
        optional: true,
      },
    },
    required: ['query'],
  },
};

// Tool: List FogBugz metadata entities
export const listMetadataTool: Tool = {
  name: 'fogbugz_list_metadata',
  description:
    'Lists FogBugz metadata: people, projects, areas, milestones, priorities, ' +
    'statuses, or categories. Use this to discover valid assignees before ' +
    'assigning a case, or valid status names before resolving one.',
  inputSchema: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        description:
          'What to list: "people", "projects", "areas", "milestones", "priorities", ' +
          '"statuses", "categories", or "currentUser".',
      },
      project: {
        type: ['number', 'string'],
        description: 'Filter areas or milestones to this project (ID or name)',
        optional: true,
      },
      category: {
        type: 'number',
        description: 'Filter statuses to this category ID (e.g. Bug vs Feature)',
        optional: true,
      },
      resolvedOnly: {
        type: 'boolean',
        description: 'For entity="statuses", return only resolved statuses',
        optional: true,
      },
      includeInactive: {
        type: 'boolean',
        description:
          'For entity="people", also include deleted, virtual, and community users ' +
          '(default: false)',
        optional: true,
      },
    },
    required: ['entity'],
  },
};

// Tool: Get a direct link to a FogBugz case
export const getCaseLinkTool: Tool = {
  name: 'fogbugz_get_case_link',
  description: 'Gets a direct URL link to a FogBugz case.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to get a link for',
      },
    },
    required: ['caseId'],
  },
};

// Tool: Create a new FogBugz project
export const createProjectTool: Tool = {
  name: 'fogbugz_create_project',
  description: 'Creates a new project in FogBugz.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the project to create',
      },
      primaryContact: {
        type: ['string', 'number'],
        description: 'User ID or name of the primary contact for the project',
        optional: true,
      },
      isInbox: {
        type: 'boolean',
        description: 'Whether this is an inbox project (default: false)',
        optional: true,
      },
      allowPublicSubmit: {
        type: 'boolean',
        description: 'Whether to allow public submissions to this project',
        optional: true,
      }
    },
    required: ['name'],
  },
};

// All tools
export const fogbugzTools = [
  createCaseTool,
  updateCaseTool,
  addCommentTool,
  assignCaseTool,
  resolveCaseTool,
  closeCaseTool,
  reopenCaseTool,
  getCaseTool,
  listUserCasesTool,
  searchCasesTool,
  listMetadataTool,
  getCaseLinkTool,
  createProjectTool,
];
