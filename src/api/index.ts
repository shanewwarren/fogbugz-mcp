import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import {
  FogBugzConfig,
  FogBugzCase,
  FogBugzProject,
  FogBugzArea,
  FogBugzFixFor,
  FogBugzPriority,
  FogBugzPerson,
  CreateCaseParams,
  EditCaseParams,
  SearchParams,
  FileAttachment,
  CreateProjectParams,
  CaseActionParams,
  ListPeopleParams,
  FogBugzStatus,
  FogBugzCategory
} from './types';

// Interface for the JSON payload sent to FogBugz API
interface FogBugzJsonPayload {
  cmd: string;
  token: string;
  nFileCount?: number;
  q?: string;
  cols?: string[] | string;
  max?: number;
  [key: string]: any;
}

export class FogBugzApi {
  private baseUrl: string;
  private apiKey: string;
  private apiEndpoint: string;
  /** Memoized `listStatus` result -- status IDs are stable for a process. */
  private statusCache: FogBugzStatus[] | null = null;

  /**
   * Create a new FogBugz API client
   */
  constructor(config: FogBugzConfig) {
    this.baseUrl = config.baseUrl.endsWith('/') 
      ? config.baseUrl.slice(0, -1) 
      : config.baseUrl;
    this.apiKey = config.apiKey;
    this.apiEndpoint = `${this.baseUrl}/f/api/0/jsonapi`;
  }

  /**
   * Make a request to the FogBugz API
   */
  private async request<T>(
    cmd: string, 
    params: Record<string, any> = {}, 
    files: FileAttachment[] = []
  ): Promise<T> {
    try {
      let response;

      // Convert string cols to array format as required by JSON API
      if (params.cols && typeof params.cols === 'string') {
        params.cols = params.cols.split(',');
      }

      // If we have files, use multipart/form-data with a json field
      if (files.length > 0) {
        const form = new FormData();
        
        // Create the JSON payload
        const jsonPayload: FogBugzJsonPayload = {
          cmd,
          token: this.apiKey,
          ...params
        };
        
        // Add files
        let fileCount = 0;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (fs.existsSync(file.path)) {
            const fieldName = file.fieldName || `File${i+1}`;
            form.append(fieldName, fs.createReadStream(file.path));
            fileCount++;
          }
        }
        
        if (fileCount > 0) {
          jsonPayload.nFileCount = fileCount;
        }
        
        // Add the JSON payload as a string field named 'json'
        form.append('json', JSON.stringify(jsonPayload));
        
        response = await axios.post(this.apiEndpoint, form, {
          headers: {
            ...form.getHeaders(),
          },
        });
      } else {
        // Regular JSON for standard requests
        const jsonPayload: FogBugzJsonPayload = {
          cmd,
          token: this.apiKey,
          ...params
        };
        
        response = await axios.post(this.apiEndpoint, jsonPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (response.data.errors && response.data.errors.length > 0) {
        const errorMsg = response.data.errors.map((e: any) => e.message).join(', ');
        throw new Error(`FogBugz API Error: ${errorMsg}`);
      }

      return response.data.data as T;
    } catch (error: any) {
      if (error.response) {
        const errorData = error.response.data;
        const errorMsg = errorData.errors && errorData.errors.length > 0
          ? errorData.errors.map((e: any) => e.message).join(', ')
          : JSON.stringify(errorData);
        
        throw new Error(`FogBugz API Error: ${error.response.status} - ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * Get information about the current user associated with the API key
   */
  async getCurrentUser(): Promise<FogBugzPerson> {
    const response = await this.request<{ person: FogBugzPerson }>('viewPerson');
    return response.person;
  }

  /**
   * Get a list of all projects
   */
  async listProjects(): Promise<FogBugzProject[]> {
    const response = await this.request<{ projects: FogBugzProject[] }>('listProjects');
    return response.projects;
  }

  /**
   * Get a list of all areas
   */
  async listAreas(): Promise<FogBugzArea[]> {
    const response = await this.request<{ areas: FogBugzArea[] }>('listAreas');
    return response.areas;
  }

  /**
   * Get a list of all milestones (FixFors)
   */
  async listMilestones(): Promise<FogBugzFixFor[]> {
    const response = await this.request<{ fixfors: FogBugzFixFor[] }>('listFixFors');
    return response.fixfors;
  }

  /**
   * Get a list of all priorities
   */
  async listPriorities(): Promise<FogBugzPriority[]> {
    const response = await this.request<{ priorities: FogBugzPriority[] }>('listPriorities');
    return response.priorities;
  }

  /**
   * Get a list of all people (users)
   */
  async listPeople(params: ListPeopleParams = {}): Promise<FogBugzPerson[]> {
    const response = await this.request<{ people: FogBugzPerson[] }>('listPeople', params);
    return response.people;
  }

  /**
   * Get a list of statuses, optionally scoped to a category.
   *
   * The command is `listStatuses`, not the `listStatus` given in docs/08-lists.md
   * -- the singular form returns "Error 27: No such API command" on a live instance.
   */
  async listStatuses(ixCategory?: number, fResolved?: boolean): Promise<FogBugzStatus[]> {
    const params: Record<string, any> = {};
    if (ixCategory !== undefined) params.ixCategory = ixCategory;
    if (fResolved !== undefined) params.fResolved = fResolved;

    const response = await this.request<{ statuses: FogBugzStatus[] }>('listStatuses', params);
    return response.statuses;
  }

  /**
   * Get a list of all categories
   */
  async listCategories(): Promise<FogBugzCategory[]> {
    const response = await this.request<{ categories: FogBugzCategory[] }>('listCategories');
    return response.categories;
  }

  /**
   * Translate a status name like "Resolved (Fixed)" into its ixStatus.
   *
   * Status IDs differ per category, so an optional category scopes the match.
   * Matching is case-insensitive; an exact match wins over a partial one.
   */
  async resolveStatusId(name: string, ixCategory?: number): Promise<number> {
    if (!this.statusCache) {
      this.statusCache = await this.listStatuses();
    }

    const target = name.trim().toLowerCase();
    const inScope = this.statusCache.filter(
      (s) => ixCategory === undefined || s.ixCategory === ixCategory
    );

    const exact = inScope.find((s) => s.sStatus.toLowerCase() === target);
    if (exact) return exact.ixStatus;

    const partial = inScope.filter((s) => s.sStatus.toLowerCase().includes(target));
    if (partial.length === 1) return partial[0].ixStatus;

    const available = inScope.map((s) => `"${s.sStatus}" (${s.ixStatus})`).join(', ');
    if (partial.length > 1) {
      throw new Error(
        `Status "${name}" is ambiguous -- it matches ${partial.length} statuses. ` +
          `Use an exact name or a numeric ixStatus. Available: ${available}`
      );
    }
    throw new Error(`Unknown status "${name}". Available: ${available}`);
  }

  /**
   * Resolve a case. `ixStatus` picks which resolved state to move it into.
   */
  async resolveCase(params: CaseActionParams): Promise<FogBugzCase> {
    const response = await this.request<{ case: FogBugzCase }>('resolve', params);
    return response.case;
  }

  /**
   * Close a case. In FogBugz this is a distinct step after resolving.
   */
  async closeCase(params: CaseActionParams): Promise<FogBugzCase> {
    const response = await this.request<{ case: FogBugzCase }>('close', params);
    return response.case;
  }

  /**
   * Reopen a previously resolved or closed case.
   */
  async reopenCase(params: CaseActionParams): Promise<FogBugzCase> {
    const response = await this.request<{ case: FogBugzCase }>('reopen', params);
    return response.case;
  }

  /**
   * Create a new case
   */
  async createCase(
    params: CreateCaseParams, 
    attachments: FileAttachment[] = []
  ): Promise<FogBugzCase> {
    const response = await this.request<{ case: FogBugzCase }>('new', params, attachments);
    return response.case;
  }

  /**
   * Update an existing case
   */
  async updateCase(
    params: EditCaseParams, 
    attachments: FileAttachment[] = []
  ): Promise<FogBugzCase> {
    const response = await this.request<{ case: FogBugzCase }>('edit', params, attachments);
    return response.case;
  }

  /**
   * Assign a case to a person
   */
  async assignCase(
    caseId: number, 
    personName: string
  ): Promise<FogBugzCase> {
    const params = {
      ixBug: caseId,
      sPersonAssignedTo: personName
    };
    
    const response = await this.request<{ case: FogBugzCase }>('assign', params);
    return response.case;
  }

  /**
   * Search for cases
   */
  async searchCases(params: SearchParams): Promise<FogBugzCase[]> {
    const response = await this.request<{ cases: FogBugzCase[] }>('search', params);
    return response.cases;
  }

  /**
   * Get a direct link to a case
   */
  getCaseLink(caseId: number): string {
    return `${this.baseUrl}/default.asp?${caseId}`;
  }

  /**
   * Create a new project
   */
  async createProject(params: CreateProjectParams): Promise<FogBugzProject> {
    // Create a new params object with converted values
    const apiParams: Record<string, any> = {};
    
    // Copy all string and number parameters
    apiParams.sProject = params.sProject;
    if (params.ixPersonPrimaryContact !== undefined) {
      apiParams.ixPersonPrimaryContact = params.ixPersonPrimaryContact;
    }
    
    // Convert boolean parameters to 0/1 format expected by FogBugz API
    if (params.fInbox !== undefined) {
      apiParams.fInbox = params.fInbox ? 1 : 0;
    }
    if (params.fAllowPublicSubmit !== undefined) {
      apiParams.fAllowPublicSubmit = params.fAllowPublicSubmit ? 1 : 0;
    }

    const response = await this.request<{ project: FogBugzProject }>('newProject', apiParams);
    return response.project;
  }
}

export * from './types';
export * from './columns';
