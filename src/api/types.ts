/**
 * FogBugz API Types
 */

export interface FogBugzConfig {
  baseUrl: string;
  apiKey: string;
}

export interface FogBugzCase {
  ixBug: number;
  sTitle: string;
  sStatus?: string;
  ixStatus?: number;
  sPriority?: string;
  ixPriority?: number;
  sProject?: string;
  ixProject?: number;
  sArea?: string;
  ixArea?: number;
  sFixFor?: string;
  ixFixFor?: number;
  sPersonAssignedTo?: string;
  ixPersonAssignedTo?: number;
  events?: FogBugzEvent[];
  [key: string]: any;
}

export interface FogBugzEvent {
  ixBugEvent: number;
  sVerb: string;
  sText?: string;
  dt: string;
  sPerson: string;
  ixPerson: number;
  rgAttachments?: FogBugzAttachment[] | { attachment?: FogBugzAttachment | FogBugzAttachment[] };
  [key: string]: any;
}

/**
 * An attachment on an event. `sURL` is a relative FogBugz download path
 * (e.g. `default.asp?pg=pgDownload&pgType=pgFile&ixBugEvent=...&ixAttachment=...`)
 * that requires the API token appended to actually fetch the bytes. It is
 * returned WITHOUT the token so it can be surfaced safely; downloading is done
 * server-side via `FogBugzApi.downloadAttachment`.
 */
export interface FogBugzAttachment {
  sFileName?: string;
  sURL?: string;
  [key: string]: any;
}

export interface DownloadedAttachment {
  contentType: string;
  data: Buffer;
}

export interface FogBugzProject {
  ixProject: number;
  sProject: string;
  [key: string]: any;
}

export interface FogBugzArea {
  ixArea: number;
  sArea: string;
  ixProject: number;
  [key: string]: any;
}

export interface FogBugzFixFor {
  ixFixFor: number;
  sFixFor: string;
  [key: string]: any;
}

export interface FogBugzPriority {
  ixPriority: number;
  sPriority: string;
  [key: string]: any;
}

export interface FogBugzPerson {
  ixPerson: number;
  sPerson?: string;
  sFullName?: string;
  sEmail: string;
  [key: string]: any;
}

export interface CreateCaseParams {
  sTitle: string;
  sEvent?: string;
  sProject?: string;
  ixProject?: number;
  sArea?: string;
  ixArea?: number;
  sFixFor?: string;
  ixFixFor?: number;
  sPriority?: string;
  ixPriority?: number;
  sPersonAssignedTo?: string;
  ixPersonAssignedTo?: number;
  [key: string]: any;
}

export interface EditCaseParams {
  ixBug: number;
  sTitle?: string;
  sEvent?: string;
  sProject?: string;
  ixProject?: number;
  sArea?: string;
  ixArea?: number;
  sFixFor?: string;
  ixFixFor?: number;
  sPriority?: string;
  ixPriority?: number;
  sPersonAssignedTo?: string;
  ixPersonAssignedTo?: number;
  [key: string]: any;
}

export interface SearchParams {
  q: string;
  cols?: string[] | string;
  max?: number;
}

export interface CreateProjectParams {
  sProject: string;
  ixPersonPrimaryContact?: number;
  fAllowPublicSubmit?: boolean;
  fInbox?: boolean;
}

export interface FileAttachment {
  path: string;
  fieldName?: string;
} 