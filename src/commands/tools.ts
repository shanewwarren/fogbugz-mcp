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
      attachmentPath: {
        type: 'string',
        description: 'Path to a screenshot or file to attach',
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
    },
    required: ['query'],
  },
};

// Tool: Get a single case with its full event/comment history
export const getCaseTool: Tool = {
  name: 'fogbugz_get_case',
  description:
    'Gets a single FogBugz case with full detail, including its event/comment history (who changed status, resolution notes, and discussion) and any file attachments per event. Use this to understand what a case is really about and what a prior "fix" actually did. Each attachment lists a `fileName` and a `url` — pass that `url` to fogbugz_get_attachment to fetch the file contents.',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'number',
        description: 'The ID of the case to fetch',
      },
      maxEvents: {
        type: 'number',
        description:
          'Optional cap on number of events returned (keeps the most recent). Omit for full history.',
        optional: true,
      },
    },
    required: ['caseId'],
  },
};

// Tool: Download an attachment's contents
export const getAttachmentTool: Tool = {
  name: 'fogbugz_get_attachment',
  description:
    "Downloads a FogBugz case attachment and returns its contents. Text files (html, css, js, json, xml, csv, txt, md) come back as `text`; binary files come back base64-encoded. Get the `url` (or fileName) from fogbugz_get_case first. The API token is applied server-side, so it is never exposed.",
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description:
          "The attachment's relative download URL as returned by fogbugz_get_case (preferred). If omitted, provide caseId + fileName.",
        optional: true,
      },
      caseId: {
        type: 'number',
        description: 'Case to look the attachment up on (used with fileName when url is omitted).',
        optional: true,
      },
      fileName: {
        type: 'string',
        description: 'Attachment file name to fetch (used with caseId when url is omitted).',
        optional: true,
      },
      maxBytes: {
        type: 'number',
        description: 'Cap on returned content size in bytes (default 200000). Content beyond this is truncated.',
        optional: true,
      },
    },
    required: [],
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

const pageIdProp = {
  type: ['number', 'string'],
  description: 'Wiki page id: 184, "W184", or the page URL (e.g. https://x.fogbugz.com/f/page?W184).',
};

const bodyProps = {
  body: {
    type: 'string',
    description:
      'Page content. Markdown by default (GitHub-style tables, fenced code, raw HTML allowed); a leading "# Heading" becomes the page title and is removed from the body.',
  },
  format: {
    type: 'string',
    enum: ['markdown', 'html'],
    description: 'How to interpret body. Default "markdown"; use "html" to send FogBugz HTML verbatim.',
  },
  tags: {
    type: ['array', 'string'],
    items: { type: 'string' },
    description: 'Tags for the page, as an array or a comma-separated string.',
  },
};

export const listWikisTool: Tool = {
  name: 'fogbugz_list_wikis',
  description: 'Lists FogBugz wikis (id, title, root page). Use the id with the other wiki tools.',
  inputSchema: {
    type: 'object',
    properties: {
      includeDeleted: { type: 'boolean', description: 'Include deleted wikis (default false).' },
    },
    required: [],
  },
};

export const listWikiArticlesTool: Tool = {
  name: 'fogbugz_list_wiki_articles',
  description:
    'Lists wiki pages (id, title, link). Omit wikiId to search every wiki, e.g. to find which wiki a page lives in or whether a title already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      wikiId: { type: 'number', description: 'Only list pages in this wiki.' },
      titleContains: { type: 'string', description: 'Case-insensitive filter on the page title.' },
    },
    required: [],
  },
};

export const getWikiArticleTool: Tool = {
  name: 'fogbugz_get_wiki_article',
  description:
    'Gets a wiki page: title, tags, current revision number, and its HTML body. Pass the revision to fogbugz_edit_wiki_article as expectedRevision to avoid overwriting someone else\'s edit.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: pageIdProp,
      revision: { type: 'number', description: 'A specific past revision to fetch. Omit for the latest.' },
    },
    required: ['pageId'],
  },
};

export const createWikiArticleTool: Tool = {
  name: 'fogbugz_create_wiki_article',
  description: 'Creates a new page in a FogBugz wiki from markdown or HTML. Returns the new page id and link.',
  inputSchema: {
    type: 'object',
    properties: {
      wikiId: { type: 'number', description: 'Wiki to add the page to (see fogbugz_list_wikis).' },
      title: { type: 'string', description: 'Page title. Optional if a markdown body starts with "# Title".' },
      ...bodyProps,
    },
    required: ['wikiId', 'body'],
  },
};

export const editWikiArticleTool: Tool = {
  name: 'fogbugz_edit_wiki_article',
  description:
    'Edits a wiki page. A new body REPLACES the whole page (FogBugz keeps the old version as a revision). Only the fields you pass change.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: pageIdProp,
      title: { type: 'string', description: 'New page title.' },
      ...bodyProps,
      comment: { type: 'string', description: 'Revision comment shown in the page history.' },
      expectedRevision: {
        type: 'number',
        description: 'Refuse the edit unless the page is still at this revision (from fogbugz_get_wiki_article).',
      },
    },
    required: ['pageId'],
  },
};

export const listWikiRevisionsTool: Tool = {
  name: 'fogbugz_list_wiki_revisions',
  description: 'Lists the revision history of a wiki page (revision number, editor id, date, comment).',
  inputSchema: {
    type: 'object',
    properties: { pageId: pageIdProp },
    required: ['pageId'],
  },
};

export const createWikiTool: Tool = {
  name: 'fogbugz_create_wiki',
  description: 'Creates a new FogBugz wiki (a container of pages). Returns its id and root page.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Wiki title.' },
      tagline: { type: 'string', description: 'Short HTML description shown under the title.' },
    },
    required: ['title'],
  },
};

export const startWikiUploadTool: Tool = {
  name: 'fogbugz_start_wiki_upload',
  description:
    'Step 1 of attaching a local image/file from any machine: returns an uploadId and a ready-to-run curl command (30-minute presigned link, no credentials needed). Run the command where the file lives, then call fogbugz_upload_wiki_file with the uploadId.',
  inputSchema: {
    type: 'object',
    properties: {
      fileName: { type: 'string', description: 'Name of the file being uploaded, e.g. "architecture.png".' },
      contentType: { type: 'string', description: 'MIME type override. Guessed from the extension if omitted.' },
    },
    required: ['fileName'],
  },
};

export const uploadWikiFileTool: Tool = {
  name: 'fogbugz_upload_wiki_file',
  description:
    'Attaches an image or file to a wiki and returns its URL plus a ready-to-paste markdown snippet to embed in a page body. Give exactly one source: uploadId (from fogbugz_start_wiki_upload; preferred for local files), url (server fetches it), filePath (a path visible to the MCP server), or base64 (tiny files only).',
  inputSchema: {
    type: 'object',
    properties: {
      wikiId: { type: 'number', description: 'Wiki to attach the file to.' },
      uploadId: { type: 'string', description: 'uploadId from fogbugz_start_wiki_upload, after its curl command has run.' },
      url: { type: 'string', description: 'http(s) URL the server downloads the file from.' },
      filePath: { type: 'string', description: 'Path readable by the MCP server process.' },
      base64: { type: 'string', description: 'File bytes, base64 (a data: URL prefix is accepted).' },
      fileName: { type: 'string', description: 'Name to store it under. Required with base64; defaults to the source name otherwise.' },
      contentType: { type: 'string', description: 'MIME type override, e.g. image/png. Guessed from the name if omitted.' },
    },
    required: ['wikiId'],
  },
};

// All tools
export const fogbugzTools = [
  createCaseTool,
  updateCaseTool,
  assignCaseTool,
  listUserCasesTool,
  searchCasesTool,
  getCaseTool,
  getAttachmentTool,
  getCaseLinkTool,
  createProjectTool,
  listWikisTool,
  listWikiArticlesTool,
  getWikiArticleTool,
  createWikiArticleTool,
  editWikiArticleTool,
  listWikiRevisionsTool,
  createWikiTool,
  startWikiUploadTool,
  uploadWikiFileTool,
];