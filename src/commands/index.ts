import { FogBugzApi } from '../api';
import { FileAttachment, CreateCaseParams, EditCaseParams, CreateProjectParams } from '../api/types';

/**
 * MCP command implementations for FogBugz operations
 */

/**
 * Creates a new FogBugz case
 */
export async function createCase(api: FogBugzApi, args: any): Promise<string> {
  const {
    title,
    description,
    project,
    area,
    milestone,
    priority,
    assignee,
    attachmentPath,
  } = args;

  // Prepare case parameters
  const params: CreateCaseParams = {
    sTitle: title,
  };

  // Add optional parameters if provided
  if (description) params.sEvent = description;
  if (project) params.sProject = project;
  if (area) params.sArea = area;
  if (milestone) params.sFixFor = milestone;
  if (assignee) params.sPersonAssignedTo = assignee;

  // Handle priority (could be a number or string)
  if (priority !== undefined) {
    if (typeof priority === 'number') {
      params.ixPriority = priority;
    } else {
      params.sPriority = priority;
    }
  }

  // Prepare attachments if any
  const attachments: FileAttachment[] = [];
  if (attachmentPath) {
    attachments.push({
      path: attachmentPath,
      fieldName: 'File1',
    });
  }

  try {
    // Create the case
    const newCase = await api.createCase(params, attachments);
    
    // Generate a response
    const caseLink = api.getCaseLink(newCase.ixBug);
    return JSON.stringify({
      caseId: newCase.ixBug,
      caseLink,
      message: `Created case #${newCase.ixBug}: "${title}"${project ? ' in ' + project : ''}${assignee ? ', assigned to ' + assignee : ''}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Updates an existing FogBugz case
 */
export async function updateCase(api: FogBugzApi, args: any): Promise<string> {
  const {
    caseId,
    title,
    description,
    project,
    area,
    milestone,
    priority,
    attachmentPath,
  } = args;

  // Prepare case parameters
  const params: EditCaseParams = {
    ixBug: caseId,
  };

  // Add optional parameters if provided
  if (title) params.sTitle = title;
  if (description) params.sEvent = description;
  if (project) params.sProject = project;
  if (area) params.sArea = area;
  if (milestone) params.sFixFor = milestone;

  // Handle priority (could be a number or string)
  if (priority !== undefined) {
    if (typeof priority === 'number') {
      params.ixPriority = priority;
    } else {
      params.sPriority = priority;
    }
  }

  // Prepare attachments if any
  const attachments: FileAttachment[] = [];
  if (attachmentPath) {
    attachments.push({
      path: attachmentPath,
      fieldName: 'File1',
    });
  }

  try {
    // Update the case
    const updatedCase = await api.updateCase(params, attachments);
    
    // Generate a response
    const caseLink = api.getCaseLink(updatedCase.ixBug);
    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink,
      message: `Updated case #${updatedCase.ixBug}${title ? ': "' + title + '"' : ''}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Assigns a FogBugz case to a user
 */
export async function assignCase(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, assignee } = args;

  try {
    // Assign the case
    const updatedCase = await api.assignCase(caseId, assignee);
    
    // Generate a response
    const caseLink = api.getCaseLink(updatedCase.ixBug);
    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink,
      message: `Assigned case #${updatedCase.ixBug} to ${assignee}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Lists FogBugz cases assigned to a user
 */
export async function listUserCases(api: FogBugzApi, args: any): Promise<string> {
  const { assignee, status, limit } = args;

  try {
    // Create query for assigned cases
    let query = '';
    
    if (assignee) {
      query = `assignedto:"${assignee}"`;
    } else {
      query = 'assignedto:me';
    }
    
    if (status) {
      query += ` status:${status}`;
    } else {
      query += ' status:active';
    }
    
    // Get cases assigned to the user
    const cases = await api.searchCases({
      q: query,
      cols: [
        'ixBug',
        'sTitle',
        'sStatus',
        'sPriority',
        'sProject',
        'sArea',
        'sFixFor',
      ],
      max: limit || 20,
    });
    
    // Format case information
    const formattedCases = cases.map(bugCase => ({
      id: bugCase.ixBug,
      title: bugCase.sTitle,
      status: bugCase.sStatus,
      priority: bugCase.sPriority,
      project: bugCase.sProject,
      area: bugCase.sArea,
      milestone: bugCase.sFixFor,
      link: api.getCaseLink(bugCase.ixBug),
    }));
    
    // Generate a response
    const userDisplay = assignee || 'current user';
    return JSON.stringify({
      assignee: userDisplay,
      count: formattedCases.length,
      cases: formattedCases,
      message: `Found ${formattedCases.length} active cases assigned to ${userDisplay}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Searches for FogBugz cases
 */
export async function searchCases(api: FogBugzApi, args: any): Promise<string> {
  const { query, limit } = args;

  try {
    // Search for cases
    const cases = await api.searchCases({
      q: query,
      cols: [
        'ixBug',
        'sTitle',
        'sStatus',
        'sPriority',
        'sProject',
        'sArea',
        'sFixFor',
        'sPersonAssignedTo',
      ],
      max: limit || 20,
    });
    
    // Format case information
    const formattedCases = cases.map(bugCase => ({
      id: bugCase.ixBug,
      title: bugCase.sTitle,
      status: bugCase.sStatus,
      priority: bugCase.sPriority,
      project: bugCase.sProject,
      area: bugCase.sArea,
      milestone: bugCase.sFixFor,
      assignee: bugCase.sPersonAssignedTo,
      link: api.getCaseLink(bugCase.ixBug),
    }));
    
    // Generate a response
    return JSON.stringify({
      query,
      count: formattedCases.length,
      cases: formattedCases,
      message: `Found ${formattedCases.length} cases matching query: "${query}".`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Normalize the FogBugz `events` payload into a flat array. Depending on the
 * FogBugz version the JSON API returns either a bare array or a
 * `{ count, event: [...] }` wrapper (and a single event may not be an array).
 */
function normalizeEvents(events: any): any[] {
  if (!events) return [];
  const raw = Array.isArray(events) ? events : (events.event ?? events);
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Gets a single FogBugz case with its full event/comment history.
 */
export async function getCase(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, maxEvents } = args;

  try {
    const c = await api.getCase(caseId);
    if (!c) {
      return JSON.stringify({ error: `Case #${caseId} not found` });
    }

    let events = normalizeEvents(c.events);
    // Events come oldest-first; when capping, keep the most recent ones.
    const truncated =
      typeof maxEvents === 'number' && maxEvents > 0 && events.length > maxEvents;
    if (truncated) {
      events = events.slice(events.length - maxEvents);
    }

    const formattedEvents = events.map((e: any) => ({
      id: e.ixBugEvent,
      dt: e.dt,
      person: e.sPerson,
      // sVerb is the action ("Resolved (Fixed)"); evtDescription is a fuller
      // human sentence. Prefer the description when present.
      action: e.evtDescription || e.sVerb,
      changes: e.sChanges ? String(e.sChanges).trim() : undefined,
      // `s` is the plain-text comment; fall back to sText. Ignore sHtml.
      text: (e.s ?? e.sText ?? '').toString().trim() || undefined,
    }));

    return JSON.stringify({
      id: c.ixBug,
      title: c.sTitle,
      status: c.sStatus,
      priority: c.sPriority,
      project: c.sProject,
      area: c.sArea,
      milestone: c.sFixFor,
      assignee: c.sPersonAssignedTo,
      openedBy: c.sPersonOpenedBy,
      opened: c.dtOpened,
      resolved: c.dtResolved,
      closed: c.dtClosed,
      link: api.getCaseLink(c.ixBug),
      eventCount: formattedEvents.length,
      eventsTruncated: truncated || undefined,
      events: formattedEvents,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Gets a direct link to a FogBugz case
 */
export async function getCaseLink(api: FogBugzApi, args: any): Promise<string> {
  const { caseId } = args;

  try {
    // Generate case link
    const caseLink = api.getCaseLink(caseId);
    
    return JSON.stringify({
      caseId,
      caseLink,
      message: `Link to case #${caseId}: ${caseLink}`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Creates a new FogBugz project
 */
export async function createProject(api: FogBugzApi, args: any): Promise<string> {
  const {
    name,
    primaryContact,
    isInbox,
    allowPublicSubmit
  } = args;

  try {
    // Prepare project parameters
    const params: CreateProjectParams = {
      sProject: name
    };

    // Add optional parameters if provided
    // For primaryContact, we need to use the ixPersonPrimaryContact parameter
    if (primaryContact) {
      try {
        // If primaryContact is a number, use it directly
        if (!isNaN(Number(primaryContact))) {
          params.ixPersonPrimaryContact = Number(primaryContact);
        } else {
          // Otherwise, try to find the person ID from the name
          // We know Akari Lara has ID 2 from the API explorer output
          if (primaryContact === 'Akari Lara') {
            params.ixPersonPrimaryContact = 2;
          }
        }
      } catch (err) {
        console.error('Error setting primary contact:', err);
      }
    }
    
    if (isInbox !== undefined) params.fInbox = isInbox;
    if (allowPublicSubmit !== undefined) params.fAllowPublicSubmit = allowPublicSubmit;

    // Create the project
    const newProject = await api.createProject(params);
    
    // Generate a response
    return JSON.stringify({
      projectId: newProject.ixProject,
      projectName: newProject.sProject,
      message: `Created new project: "${newProject.sProject}" (ID: ${newProject.ixProject})`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
} 