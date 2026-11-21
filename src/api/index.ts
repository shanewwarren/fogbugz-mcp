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
  DownloadedAttachment,
  FogBugzWiki,
  FogBugzWikiArticleSummary,
  FogBugzWikiArticle,
  FogBugzWikiRevision,
  NewArticleParams,
  EditArticleParams,
  WikiFileUploadResult
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

      return this.unwrap<T>(response.data);
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

  private unwrap<T>(body: any): T {
    if (body.errors && body.errors.length > 0) {
      const errorMsg = body.errors.map((e: any) => e.message).join(', ');
      throw new Error(`FogBugz API Error: ${errorMsg}`);
    }
    return body.data as T;
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
  async listPeople(): Promise<FogBugzPerson[]> {
    const response = await this.request<{ people: FogBugzPerson[] }>('listPeople');
    return response.people;
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
   * Get a single case with full detail, including its event/comment history.
   * FogBugz returns the narrative history via the `events` column on `search`.
   */
  async getCase(caseId: number, cols?: string[]): Promise<FogBugzCase | null> {
    const defaultCols = [
      'ixBug',
      'sTitle',
      'sStatus',
      'sPriority',
      'sProject',
      'sArea',
      'sFixFor',
      'sPersonAssignedTo',
      'sPersonOpenedBy',
      'dtOpened',
      'dtResolved',
      'dtClosed',
      'sLatestTextSummary',
      'events',
      // Attachments ride inside each event as `rgAttachments`, but some
      // FogBugz versions only populate them when the column is named.
      'rgAttachments',
    ];
    const response = await this.request<{ cases: FogBugzCase[] }>('search', {
      q: String(caseId),
      cols: cols && cols.length ? cols : defaultCols,
      max: 1,
    });
    const cases = response.cases || [];
    return cases.length > 0 ? cases[0] : null;
  }

  /**
   * Download an attachment's raw bytes. `sURL` is the relative FogBugz
   * download path returned on an event's attachment (WITHOUT the token). The
   * API token is appended here, server-side, so it never leaves this process.
   */
  async downloadAttachment(sURL: string): Promise<DownloadedAttachment> {
    // FogBugz encodes the ampersands in the returned sURL as `&amp;`.
    const rel = sURL.replace(/&amp;/g, '&').replace(/^\//, '');
    const sep = rel.includes('?') ? '&' : '?';
    const url = rel.includes('token=')
      ? `${this.baseUrl}/${rel}`
      : `${this.baseUrl}/${rel}${sep}token=${this.apiKey}`;

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return {
      contentType: String(response.headers['content-type'] || ''),
      data: Buffer.from(response.data),
    };
  }

  /**
   * Get a direct link to a case
   */
  getCaseLink(caseId: number): string {
    return `${this.baseUrl}/default.asp?${caseId}`;
  }

  async listWikis(): Promise<FogBugzWiki[]> {
    const response = await this.request<{ wikis: FogBugzWiki[] }>('listWikis');
    return response.wikis || [];
  }

  async newWiki(title: string, tagLineHTML?: string): Promise<{ ixWiki: number }> {
    const params: Record<string, any> = { s: title };
    if (tagLineHTML) params.sTagLineHTML = tagLineHTML;
    const response = await this.request<{ wiki: { ixWiki: number } }>('newWiki', params);
    return response.wiki;
  }

  async listArticles(ixWiki: number): Promise<FogBugzWikiArticleSummary[]> {
    const response = await this.request<{ articles: FogBugzWikiArticleSummary[] }>('listArticles', { ixWiki });
    return response.articles || [];
  }

  async viewArticle(ixWikiPage: number, nRevision?: number): Promise<FogBugzWikiArticle> {
    const params: Record<string, any> = { ixWikiPage };
    if (nRevision !== undefined) params.nRevision = nRevision;
    const response = await this.request<{ wikipage: FogBugzWikiArticle }>('viewArticle', params);
    return response.wikipage;
  }

  // Live API answers { wikipage: "" } with no id, so fall back to the headline, which FogBugz keeps unique per wiki.
  async newArticle(params: NewArticleParams): Promise<{ ixWikiPage: number }> {
    const response = await this.request<any>('newArticle', params);
    const id = response?.article?.ixWikiPage ?? response?.wikipage?.ixWikiPage;
    if (id) return { ixWikiPage: id };
    const match = (await this.listArticles(params.ixWiki)).find((a) => a.sHeadline === params.sHeadline);
    if (!match) throw new Error(`Created "${params.sHeadline}" but could not find its page id in wiki ${params.ixWiki}.`);
    return { ixWikiPage: match.ixWikiPage };
  }

  // FogBugz rejects editArticle without sHeadline (error 12), so callers must send headline and body every time.
  async editArticle(params: EditArticleParams & { sHeadline: string; sBody: string }): Promise<void> {
    await this.request('editArticle', params);
  }

  async listRevisions(ixWikiPage: number): Promise<FogBugzWikiRevision[]> {
    const response = await this.request<{ revisions: FogBugzWikiRevision[] }>('listRevisions', { ixWikiPage });
    return response.revisions || [];
  }

  // The JSON endpoint only reads params from a `json` form field; plain form fields (as the docs show) get a 400.
  async uploadWikiFile(
    ixWiki: number,
    fileName: string,
    data: Buffer,
    contentType?: string,
  ): Promise<WikiFileUploadResult> {
    const form = new FormData();
    form.append('json', JSON.stringify({ cmd: 'wikiFileUpload', token: this.apiKey, ixWiki, nFileCount: 1 }));
    form.append('File1', data, { filename: fileName, contentType: contentType || 'application/octet-stream' });
    try {
      const response = await axios.post(this.apiEndpoint, form, { headers: form.getHeaders() });
      // Live API returns { upfiles: { upfile: { ixAttachment } } }, not the { sFileName, sURL } the docs show.
      const data = this.unwrap<{ upfiles?: { upfile?: WikiFileUploadResult | WikiFileUploadResult[] } }>(response.data);
      const upfile = data.upfiles?.upfile;
      const first = Array.isArray(upfile) ? upfile[0] : upfile;
      if (!first?.ixAttachment) throw new Error(`Unexpected wikiFileUpload response: ${JSON.stringify(data)}`);
      return first;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`FogBugz API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getWikiAttachmentUrl(ixAttachment: number, fileName: string): string {
    const q = new URLSearchParams({ pg: 'pgDownload', pgType: 'pgWikiAttachment', ixAttachment: String(ixAttachment), sFileName: fileName });
    return `${this.baseUrl}/default.asp?${q.toString()}`;
  }

  getWikiPageLink(ixWikiPage: number): string {
    return `${this.baseUrl}/f/page?W${ixWikiPage}`;
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