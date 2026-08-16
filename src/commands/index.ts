import { FogBugzApi } from '../api';
import {
  FileAttachment,
  CreateCaseParams,
  EditCaseParams,
  CreateProjectParams,
  CaseActionParams,
  FogBugzCase,
  FogBugzEvent,
  NormalizedEvent,
} from '../api/types';
import { validateCols, DEFAULT_CASE_COLS, DETAIL_CASE_COLS } from '../api/columns';

/**
 * MCP command implementations for FogBugz operations
 */

/**
 * Strip an event down to what is worth reading.
 *
 * `sHTML` duplicates `s`, and attachments carry more than a filename. Both
 * `s` and `sChanges` are kept: many events have an empty body and put the
 * substance in the change log ("Title changed from 'x' to 'y'.").
 */
function normalizeEvents(events: FogBugzEvent[]): NormalizedEvent[] {
  return events.map((evt) => {
    const normalized: NormalizedEvent = {
      ixBugEvent: evt.ixBugEvent,
      dt: evt.dt,
      sPerson: evt.sPerson,
      sVerb: evt.sVerb,
    };

    if (evt.sChanges) normalized.sChanges = evt.sChanges;
    if (evt.s) normalized.s = evt.s;
    if (evt.fEmail) normalized.fEmail = evt.fEmail;

    if (Array.isArray(evt.rgAttachments) && evt.rgAttachments.length > 0) {
      normalized.attachments = evt.rgAttachments.map((att) => ({
        sFileName: att.sFileName,
        sURL: att.sURL,
      }));
    }

    return normalized;
  });
}

/**
 * Pass a case through unchanged apart from adding a link and tidying events.
 *
 * Deliberately does NOT rename fields: callers choose columns by their FogBugz
 * names, so responses use those same names.
 */
function decorateCase(api: FogBugzApi, bugCase: FogBugzCase): Record<string, any> {
  const decorated: Record<string, any> = {
    ...bugCase,
    link: api.getCaseLink(bugCase.ixBug),
  };

  if (Array.isArray(bugCase.events)) {
    decorated.events = normalizeEvents(bugCase.events);
  }

  return decorated;
}

/** Validate caller-supplied columns, or fall back to a preset. */
function resolveCols(cols: string[] | undefined, fallback: readonly string[]): string[] {
  if (cols && cols.length > 0) {
    return validateCols([...cols]);
  }
  return [...fallback];
}

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
    assignee,
    tags,
    dueDate,
    estimate,
    parentCaseId,
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
  if (assignee) params.sPersonAssignedTo = assignee;
  if (dueDate) params.dtDue = dueDate;
  if (estimate !== undefined) params.hrsCurrEst = estimate;
  if (parentCaseId !== undefined) params.ixBugParent = parentCaseId;

  // FogBugz expects tags as a comma-delimited string
  if (tags !== undefined) {
    params.sTags = Array.isArray(tags) ? tags.join(',') : tags;
  }

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

  // Fields worth confirming afterwards. FogBugz accepts writes to fields that
  // are disabled on an instance and applies nothing, without reporting an
  // error -- observed with hrsCurrEst. Only scalars that compare cleanly are
  // checked, to avoid false alarms.
  const expected: Record<string, any> = {};
  if (title) expected.sTitle = title;
  if (estimate !== undefined) expected.hrsCurrEst = estimate;
  if (parentCaseId !== undefined) expected.ixBugParent = parentCaseId;

  try {
    // Update the case
    const updatedCase = await api.updateCase(params, attachments);

    const warnings = await detectUnappliedFields(api, updatedCase.ixBug, expected);

    // Generate a response
    const caseLink = api.getCaseLink(updatedCase.ixBug);
    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink,
      ...(warnings.length > 0 ? { warnings } : {}),
      message: `Updated case #${updatedCase.ixBug}${title ? ': "' + title + '"' : ''}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Re-read a case and report any requested value that did not stick.
 *
 * Returns an empty array on any failure -- this is a diagnostic, and must never
 * turn a successful update into a reported error.
 */
async function detectUnappliedFields(
  api: FogBugzApi,
  caseId: number,
  expected: Record<string, any>
): Promise<string[]> {
  const fields = Object.keys(expected);
  if (fields.length === 0) return [];

  try {
    const cases = await api.searchCases({
      q: String(caseId),
      cols: ['ixBug', ...fields],
      max: 1,
    });
    if (!cases || cases.length === 0) return [];

    const fresh = cases[0];
    return fields
      .filter((f) => String(fresh[f]) !== String(expected[f]))
      .map(
        (f) =>
          `${f}: requested ${JSON.stringify(expected[f])} but the case still reads ` +
          `${JSON.stringify(fresh[f])}. FogBugz accepted the write without applying it -- ` +
          `this field may be disabled on this instance.`
      );
  } catch {
    return [];
  }
}

/**
 * Adds a comment to a FogBugz case without changing any other field
 */
export async function addComment(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, comment, attachmentPath } = args;

  const attachments: FileAttachment[] = [];
  if (attachmentPath) {
    attachments.push({
      path: attachmentPath,
      fieldName: 'File1',
    });
  }

  try {
    const updatedCase = await api.updateCase(
      { ixBug: caseId, sEvent: comment },
      attachments
    );

    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink: api.getCaseLink(updatedCase.ixBug),
      message: `Added comment to case #${updatedCase.ixBug}.`,
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
 * Resolves a FogBugz case, optionally into a specific resolved status
 */
export async function resolveCase(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, status, comment } = args;

  try {
    const params: CaseActionParams = { ixBug: caseId };
    if (comment) params.sEvent = comment;

    // Accept either a numeric ixStatus or a name like "Resolved (Fixed)"
    if (status !== undefined && status !== null && status !== '') {
      params.ixStatus =
        typeof status === 'number' ? status : await api.resolveStatusId(String(status));
    }

    const updatedCase = await api.resolveCase(params);

    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink: api.getCaseLink(updatedCase.ixBug),
      message: `Resolved case #${updatedCase.ixBug}${status ? ' as "' + status + '"' : ''}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Closes a FogBugz case
 */
export async function closeCase(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, comment } = args;

  try {
    const params: CaseActionParams = { ixBug: caseId };
    if (comment) params.sEvent = comment;

    const updatedCase = await api.closeCase(params);

    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink: api.getCaseLink(updatedCase.ixBug),
      message: `Closed case #${updatedCase.ixBug}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Reopens a resolved or closed FogBugz case
 */
export async function reopenCase(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, comment } = args;

  try {
    const params: CaseActionParams = { ixBug: caseId };
    if (comment) params.sEvent = comment;

    const updatedCase = await api.reopenCase(params);

    return JSON.stringify({
      caseId: updatedCase.ixBug,
      caseLink: api.getCaseLink(updatedCase.ixBug),
      message: `Reopened case #${updatedCase.ixBug}.`,
    });
  } catch (error: any) {
    return JSON.stringify({
      error: error.message,
    });
  }
}

/**
 * Fetches a single case with full detail, including its event history
 */
export async function getCase(api: FogBugzApi, args: any): Promise<string> {
  const { caseId, cols, includeEvents } = args;

  try {
    const selected = resolveCols(cols, DETAIL_CASE_COLS);

    // Events are the whole point of this tool, so include them by default
    if (includeEvents !== false && !selected.includes('events')) {
      selected.push('events');
    }

    const cases = await api.searchCases({
      q: String(caseId),
      cols: selected,
      max: 1,
    });

    if (!cases || cases.length === 0) {
      return JSON.stringify({
        error: `Case #${caseId} not found, or the API token lacks access to it.`,
      });
    }

    const detail = decorateCase(api, cases[0]);

    return JSON.stringify({
      case: detail,
      eventCount: Array.isArray(detail.events) ? detail.events.length : 0,
      message: `Case #${caseId}: "${detail.sTitle}"`,
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
  const { assignee, status, limit, cols } = args;

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
      cols: resolveCols(cols, DEFAULT_CASE_COLS),
      max: limit || 20,
    });

    const formattedCases = (cases || []).map((bugCase) => decorateCase(api, bugCase));

    // Generate a response
    const userDisplay = assignee || 'current user';
    return JSON.stringify({
      assignee: userDisplay,
      count: formattedCases.length,
      cases: formattedCases,
      message: `Found ${formattedCases.length} cases assigned to ${userDisplay}.`,
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
  const { query, limit, cols } = args;

  try {
    // Search for cases
    const cases = await api.searchCases({
      q: query,
      cols: resolveCols(cols, DEFAULT_CASE_COLS),
      max: limit || 20,
    });

    const formattedCases = (cases || []).map((bugCase) => decorateCase(api, bugCase));

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
 * Lists FogBugz metadata entities (people, projects, statuses, and so on)
 *
 * Consolidated into one tool so the seven underlying list commands don't each
 * take up a slot in the tool list.
 */
export async function listMetadata(api: FogBugzApi, args: any): Promise<string> {
  const { entity, project, category, resolvedOnly, includeInactive } = args;

  try {
    let items: any[];

    switch (entity) {
      case 'people':
        items = await api.listPeople({
          fIncludeDeleted: includeInactive === true,
          fIncludeVirtual: includeInactive === true,
          fIncludeCommunity: includeInactive === true,
        });
        break;
      case 'projects':
        items = await api.listProjects();
        break;
      case 'areas':
        items = await api.listAreas();
        if (project !== undefined) {
          items = items.filter(
            (a: any) => a.ixProject === project || a.sProject === project
          );
        }
        break;
      case 'milestones':
        items = await api.listMilestones();
        if (project !== undefined) {
          items = items.filter(
            (m: any) => m.ixProject === project || m.sProject === project
          );
        }
        break;
      case 'priorities':
        items = await api.listPriorities();
        break;
      case 'statuses':
        items = await api.listStatuses(
          typeof category === 'number' ? category : undefined,
          resolvedOnly === true ? true : undefined
        );
        break;
      case 'categories':
        items = await api.listCategories();
        break;
      case 'currentUser':
        return JSON.stringify({
          entity,
          user: await api.getCurrentUser(),
        });
      default:
        return JSON.stringify({
          error:
            `Unknown entity "${entity}". Valid values: people, projects, areas, ` +
            `milestones, priorities, statuses, categories, currentUser.`,
        });
    }

    return JSON.stringify({
      entity,
      count: items.length,
      items,
      message: `Found ${items.length} ${entity}.`,
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

    // Primary contact may arrive as an ID or a name; names need a lookup
    if (primaryContact) {
      if (!isNaN(Number(primaryContact))) {
        params.ixPersonPrimaryContact = Number(primaryContact);
      } else {
        const people = await api.listPeople();
        const target = String(primaryContact).trim().toLowerCase();
        const match = people.find(
          (p) =>
            (p.sFullName || '').toLowerCase() === target ||
            (p.sPerson || '').toLowerCase() === target ||
            (p.sEmail || '').toLowerCase() === target
        );

        if (!match) {
          const available = people
            .map((p) => p.sFullName || p.sPerson || p.sEmail)
            .join(', ');
          return JSON.stringify({
            error: `Unknown primary contact "${primaryContact}". Available: ${available}`,
          });
        }

        params.ixPersonPrimaryContact = match.ixPerson;
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

export { normalizeEvents };
