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
  /** Plain-text body. Often empty when the event only records field changes. */
  s?: string;
  /** HTML rendering of `s`. Redundant, and dropped during normalization. */
  sHTML?: string;
  /** Human-readable field diff, e.g. "Title changed from 'x' to 'y'." */
  sChanges?: string;
  dt: string;
  sPerson: string;
  ixPerson: number;
  fEmail?: boolean;
  rgAttachments?: FogBugzAttachment[];
  [key: string]: any;
}

export interface FogBugzAttachment {
  sFileName: string;
  sURL: string;
  [key: string]: any;
}

/** An event trimmed down for LLM consumption -- no HTML, no attachment blobs. */
export interface NormalizedEvent {
  ixBugEvent: number;
  dt: string;
  sPerson: string;
  sVerb: string;
  sChanges?: string;
  s?: string;
  fEmail?: boolean;
  attachments?: { sFileName: string; sURL: string }[];
}

export interface FogBugzStatus {
  ixStatus: number;
  sStatus: string;
  ixCategory: number;
  fWorkDone?: boolean;
  fResolved?: boolean;
  fDuplicate?: boolean;
  fDeleted?: boolean;
  [key: string]: any;
}

export interface FogBugzCategory {
  ixCategory: number;
  sCategory: string;
  sPlural?: string;
  ixStatusDefault?: number;
  [key: string]: any;
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

/** Shared shape for the resolve/close/reopen/reactivate commands. */
export interface CaseActionParams {
  ixBug: number;
  /** Optional comment recorded alongside the state change. */
  sEvent?: string;
  /** Target status -- only meaningful for `resolve`. */
  ixStatus?: number;
  [key: string]: any;
}

export interface ListPeopleParams {
  fIncludeActive?: boolean;
  fIncludeNormal?: boolean;
  fIncludeDeleted?: boolean;
  fIncludeCommunity?: boolean;
  fIncludeVirtual?: boolean;
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