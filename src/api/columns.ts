/**
 * FogBugz `cols` handling.
 *
 * The FogBugz JSON API silently ignores column names it doesn't recognize --
 * no error, no warning, the key is simply absent from the response. That makes
 * a typo indistinguishable from an empty value, so we validate up front.
 *
 * This list was produced by probing a live FogBugz instance one column at a
 * time and keeping the names that echoed back. Notably `latestEvent` and
 * `sPersonOpenedBy` are documented but NOT honored, so they are absent here.
 */

/** Every column name confirmed to be honored by the live JSON API. */
export const VALID_CASE_COLS: readonly string[] = [
  // Identity and classification
  'ixBug',
  'sTitle',
  'sStatus',
  'ixStatus',
  'sPriority',
  'ixPriority',
  'sProject',
  'ixProject',
  'sArea',
  'ixArea',
  'sFixFor',
  'ixFixFor',
  'sCategory',
  'ixCategory',
  'fOpen',
  'operations',

  // People. Note there is no `sPersonOpenedBy` -- only the ix* form resolves.
  'sPersonAssignedTo',
  'ixPersonAssignedTo',
  'ixPersonOpenedBy',
  'ixPersonResolvedBy',
  'ixPersonClosedBy',
  'ixPersonLastEditedBy',

  // Dates
  'dtOpened',
  'dtResolved',
  'dtClosed',
  'dtLastUpdated',
  'dtDue',

  // Effort
  'hrsOrigEst',
  'hrsCurrEst',
  'hrsElapsed',
  'dblStoryPts',

  // Hierarchy and relations
  'ixBugParent',
  'ixBugChildren',
  'ixRelatedBugs',
  'ixBugEventLatest',

  // Content
  'events',
  'sLatestTextSummary',
  'ixBugEventLatestText',
  'tags',
  'sTicket',
  'sVersion',
  'sComputer',
  'sCustomerEmail',
  'ixMailbox',
  'sReleaseNotes',
  'fReplied',
  'fForwarded',
  'fSubscribed',
  'ixDiscussTopic',
];

/** Custom/plugin fields are instance-specific, so they bypass validation. */
const PLUGIN_COL = /^plugin_/;

/** Sensible spread for list and search results -- no event bodies. */
export const DEFAULT_CASE_COLS: readonly string[] = [
  'ixBug',
  'sTitle',
  'sStatus',
  'sPriority',
  'sProject',
  'sArea',
  'sFixFor',
  'sPersonAssignedTo',
  'sCategory',
  'fOpen',
  'dtOpened',
  'dtLastUpdated',
  'sLatestTextSummary',
];

/** Everything worth having when looking at a single case, minus events. */
export const DETAIL_CASE_COLS: readonly string[] = [
  ...DEFAULT_CASE_COLS,
  'ixStatus',
  'ixPriority',
  'ixProject',
  'ixArea',
  'ixFixFor',
  'ixCategory',
  'ixPersonAssignedTo',
  'ixPersonOpenedBy',
  'ixPersonResolvedBy',
  'ixPersonClosedBy',
  'dtResolved',
  'dtClosed',
  'dtDue',
  'hrsOrigEst',
  'hrsCurrEst',
  'hrsElapsed',
  'dblStoryPts',
  'ixBugParent',
  'ixBugChildren',
  'ixRelatedBugs',
  'tags',
  'sVersion',
  'sCustomerEmail',
  'sReleaseNotes',
  'operations',
];

/**
 * Throw if any requested column would be silently dropped by FogBugz.
 * Returns the columns unchanged so it can be used inline.
 */
export function validateCols(cols: string[]): string[] {
  const unknown = cols.filter(
    (col) => !PLUGIN_COL.test(col) && !VALID_CASE_COLS.includes(col)
  );

  if (unknown.length > 0) {
    throw new Error(
      `Unknown FogBugz column(s): ${unknown.join(', ')}. ` +
        `FogBugz drops unrecognized columns silently, so these would have ` +
        `returned no data and no error. Valid columns: ${VALID_CASE_COLS.join(', ')}. ` +
        `Custom fields prefixed "plugin_" are also accepted.`
    );
  }

  return cols;
}
