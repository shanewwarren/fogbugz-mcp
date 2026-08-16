import axios from 'axios';
import { FogBugzApi } from '../src/api';
import { validateCols, VALID_CASE_COLS } from '../src/api/columns';
import { normalizeEvents } from '../src/commands';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

/**
 * The client unwraps `response.data.data`, so mocks need both layers.
 */
function mockApiResponse(payload: any) {
  mockAxios.post.mockResolvedValueOnce({
    data: { data: payload, errors: [], warnings: [] },
  } as any);
}

/** Grab the JSON body sent on the Nth (0-indexed) axios.post call. */
function sentBody(callIndex = 0): any {
  return (mockAxios.post as jest.Mock).mock.calls[callIndex][1];
}

describe('FogBugzApi', () => {
  const mockConfig = {
    baseUrl: 'https://test.fogbugz.com',
    apiKey: 'test-api-key'
  };

  let api: FogBugzApi;

  beforeEach(() => {
    api = new FogBugzApi(mockConfig);
    jest.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(api).toBeInstanceOf(FogBugzApi);
  });

  it('should get current user', async () => {
    mockApiResponse({
      person: {
        ixPerson: 1,
        sPerson: 'Test User',
        sEmail: 'test@example.com'
      }
    });

    const user = await api.getCurrentUser();

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://test.fogbugz.com/f/api/0/jsonapi',
      expect.objectContaining({ cmd: 'viewPerson', token: 'test-api-key' }),
      expect.any(Object)
    );

    expect(user).toEqual({
      ixPerson: 1,
      sPerson: 'Test User',
      sEmail: 'test@example.com'
    });
  });

  it('should create a case', async () => {
    mockApiResponse({
      case: {
        ixBug: 123,
        sTitle: 'Test Case',
        sPriority: 'Normal',
        sStatus: 'Active'
      }
    });

    const result = await api.createCase({
      sTitle: 'Test Case',
      sEvent: 'Test description'
    });

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ixBug: 123,
      sTitle: 'Test Case',
      sPriority: 'Normal',
      sStatus: 'Active'
    });
  });

  it('should handle API errors', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { errors: [{ message: 'Invalid token' }] }
      }
    } as any);

    await expect(api.getCurrentUser()).rejects.toThrow('FogBugz API Error');
  });

  it('should surface errors returned in a 200 response body', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: {}, errors: [{ message: 'Case not found' }] },
    } as any);

    await expect(api.searchCases({ q: '999999' })).rejects.toThrow('Case not found');
  });

  describe('case state transitions', () => {
    it('resolves with the given status and comment', async () => {
      mockApiResponse({ case: { ixBug: 42 } });

      await api.resolveCase({ ixBug: 42, ixStatus: 2, sEvent: 'Fixed it' });

      expect(sentBody()).toMatchObject({
        cmd: 'resolve',
        ixBug: 42,
        ixStatus: 2,
        sEvent: 'Fixed it',
      });
    });

    it('closes a case', async () => {
      mockApiResponse({ case: { ixBug: 42 } });

      await api.closeCase({ ixBug: 42 });

      expect(sentBody()).toMatchObject({ cmd: 'close', ixBug: 42 });
    });

    it('reopens a case', async () => {
      mockApiResponse({ case: { ixBug: 42 } });

      await api.reopenCase({ ixBug: 42, sEvent: 'Came back' });

      expect(sentBody()).toMatchObject({ cmd: 'reopen', ixBug: 42, sEvent: 'Came back' });
    });
  });

  describe('listStatuses', () => {
    it('uses listStatuses, not the listStatus given in the vendored docs', async () => {
      mockApiResponse({ statuses: [{ ixStatus: 1, sStatus: 'Active', ixCategory: 1 }] });

      const statuses = await api.listStatuses();

      // Singular returns "Error 27: No such API command" on a live instance.
      expect(sentBody()).toMatchObject({ cmd: 'listStatuses' });
      expect(statuses).toHaveLength(1);
    });

    it('passes category and resolved filters through', async () => {
      mockApiResponse({ statuses: [] });

      await api.listStatuses(1, true);

      expect(sentBody()).toMatchObject({
        cmd: 'listStatuses',
        ixCategory: 1,
        fResolved: true,
      });
    });
  });

  describe('resolveStatusId', () => {
    const STATUSES = [
      { ixStatus: 1, sStatus: 'Active', ixCategory: 1 },
      { ixStatus: 2, sStatus: 'Resolved (Fixed)', ixCategory: 1 },
      { ixStatus: 3, sStatus: 'Resolved (Not Reproducible)', ixCategory: 1 },
      { ixStatus: 8, sStatus: 'Resolved (Implemented)', ixCategory: 2 },
    ];

    it('matches an exact name case-insensitively', async () => {
      mockApiResponse({ statuses: STATUSES });

      await expect(api.resolveStatusId('resolved (fixed)')).resolves.toBe(2);
    });

    it('matches a unique partial name', async () => {
      mockApiResponse({ statuses: STATUSES });

      await expect(api.resolveStatusId('Not Reproducible')).resolves.toBe(3);
    });

    it('rejects an ambiguous partial name', async () => {
      mockApiResponse({ statuses: STATUSES });

      await expect(api.resolveStatusId('Resolved')).rejects.toThrow('ambiguous');
    });

    it('rejects an unknown name and lists the options', async () => {
      mockApiResponse({ statuses: STATUSES });

      await expect(api.resolveStatusId('Wontfix')).rejects.toThrow(
        /Unknown status "Wontfix".*Resolved \(Fixed\)/s
      );
    });

    it('scopes matching to a category when given one', async () => {
      mockApiResponse({ statuses: STATUSES });

      await expect(api.resolveStatusId('Implemented', 2)).resolves.toBe(8);
    });

    it('caches the status list across calls', async () => {
      mockApiResponse({ statuses: STATUSES });

      await api.resolveStatusId('Resolved (Fixed)');
      await api.resolveStatusId('Active');

      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});

describe('validateCols', () => {
  it('accepts known columns', () => {
    expect(validateCols(['ixBug', 'sTitle', 'events'])).toEqual([
      'ixBug',
      'sTitle',
      'events',
    ]);
  });

  it('rejects unknown columns and lists valid ones', () => {
    // sPersonOpenedBy is documented by FogBugz but silently dropped by the API,
    // which is exactly the failure this guards against.
    expect(() => validateCols(['ixBug', 'sPersonOpenedBy'])).toThrow(
      /Unknown FogBugz column\(s\): sPersonOpenedBy/
    );
  });

  it('rejects latestEvent, which the docs claim but the API ignores', () => {
    expect(() => validateCols(['latestEvent'])).toThrow(/latestEvent/);
  });

  it('allows plugin_ prefixed custom fields through', () => {
    expect(validateCols(['ixBug', 'plugin_customfield_x123'])).toEqual([
      'ixBug',
      'plugin_customfield_x123',
    ]);
  });

  it('reports every unknown column at once', () => {
    expect(() => validateCols(['bogusOne', 'bogusTwo'])).toThrow(/bogusOne, bogusTwo/);
  });

  it('does not include dropped names in the valid list', () => {
    expect(VALID_CASE_COLS).not.toContain('latestEvent');
    expect(VALID_CASE_COLS).not.toContain('sPersonOpenedBy');
    expect(VALID_CASE_COLS).toContain('events');
  });
});

describe('normalizeEvents', () => {
  it('drops the sHTML duplicate but keeps the plain body', () => {
    const [evt] = normalizeEvents([
      {
        ixBugEvent: 1,
        ixBug: 10,
        dt: '2026-06-05T02:09:16Z',
        sPerson: 'Dave Parks',
        ixPerson: 3,
        sVerb: 'Opened',
        s: 'The Table object value is not updating.',
        sHTML: '<p>The Table object value is not updating.</p>',
      },
    ]);

    expect(evt.s).toBe('The Table object value is not updating.');
    expect(evt).not.toHaveProperty('sHTML');
  });

  it('keeps sChanges when the body is empty', () => {
    // Real shape from case 2721: the substance lives in sChanges, not s.
    const [evt] = normalizeEvents([
      {
        ixBugEvent: 3,
        ixBug: 2721,
        dt: '2026-06-05T02:09:34Z',
        sPerson: 'Dave Parks',
        ixPerson: 3,
        sVerb: 'Edited',
        s: '',
        sChanges: "Title changed from 'A' to 'B'.",
      },
    ]);

    expect(evt.sChanges).toBe("Title changed from 'A' to 'B'.");
    expect(evt).not.toHaveProperty('s');
  });

  it('reduces attachments to filename and URL', () => {
    const [evt] = normalizeEvents([
      {
        ixBugEvent: 4,
        ixBug: 10,
        dt: '2026-06-05T02:09:34Z',
        sPerson: 'Hunter',
        ixPerson: 5,
        sVerb: 'Edited',
        rgAttachments: [
          { sFileName: 'screenshot.png', sURL: 'https://x/f.png', sData: 'BLOB' } as any,
        ],
      },
    ]);

    expect(evt.attachments).toEqual([
      { sFileName: 'screenshot.png', sURL: 'https://x/f.png' },
    ]);
  });

  it('preserves chronological order and identity fields', () => {
    const events = normalizeEvents([
      { ixBugEvent: 1, ixBug: 1, dt: 'a', sPerson: 'X', ixPerson: 1, sVerb: 'Opened' },
      { ixBugEvent: 2, ixBug: 1, dt: 'b', sPerson: 'Y', ixPerson: 2, sVerb: 'Assigned' },
    ]);

    expect(events.map((e) => e.ixBugEvent)).toEqual([1, 2]);
    expect(events.map((e) => e.sVerb)).toEqual(['Opened', 'Assigned']);
  });
});
