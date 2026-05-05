import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../../../database/initialize', () => ({
  getDatabase: () => ({
    query: mockQuery,
  }),
}));

vi.mock('../../../services/TrackerIdentityService', () => ({
  getCurrentIdentity: vi.fn(() => ({ displayName: 'Test User' })),
}));

vi.mock('../../../services/TrackerPolicyService', () => ({
  getEffectiveTrackerSyncPolicy: vi.fn(() => ({ mode: 'local', scope: 'project' })),
  getInitialTrackerSyncStatus: vi.fn(() => 'local'),
  shouldSyncTrackerPolicy: vi.fn(() => false),
}));

vi.mock('../../../services/TrackerSyncManager', () => ({
  isTrackerSyncActive: vi.fn(() => false),
  syncTrackerItem: vi.fn(),
}));

vi.mock('../../../services/TrackerSchemaService', () => ({
  getTrackerRoleField: vi.fn(() => null),
}));

vi.mock('../../../utils/store', () => ({
  getWorkspaceState: vi.fn(() => ({ issueKeyPrefix: 'NIM' })),
}));

vi.mock('../../../window/WindowManager', () => ({
  findWindowByWorkspace: vi.fn(() => null),
  documentServices: new Map(),
}));

vi.mock('@nimbalyst/runtime/plugins/TrackerPlugin/models/TrackerDataModel', () => ({
  globalRegistry: { get: vi.fn(() => undefined) },
}));

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}));

import { handleTrackerCreate, handleTrackerGet } from '../trackerToolHandlers';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bug_internal',
    issue_key: 'NIM-1',
    issue_number: 1,
    type: 'bug',
    type_tags: ['bug'],
    data: JSON.stringify({
      title: 'Scoped bug',
      status: 'to-do',
      priority: 'high',
    }),
    updated: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('handleTrackerGet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes issue key lookups to the active workspace', async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({ workspace: '/tmp/workspace-a' })],
    });

    const result = await handleTrackerGet({ id: 'NIM-1' }, '/tmp/workspace-a');

    expect(result.isError).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE (id = $1 OR issue_key = $1) AND workspace = $2'),
      ['NIM-1', '/tmp/workspace-a'],
    );
  });
});

describe('handleTrackerCreate session linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Drive every query handleTrackerCreate makes through one queue. The handler
  // doesn't care about return shapes for the writes; the reads need just enough
  // to keep it walking through the create flow.
  function setupCreateQueueWithoutLink() {
    const createdRow = makeRow({
      id: 'bug_test',
      workspace: '/tmp/ws',
      issue_key: null,
      issue_number: null,
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                              // INSERT
      .mockResolvedValueOnce({ rows: [createdRow] })                    // resolve created
      .mockResolvedValueOnce({ rows: [{ max_num: 0 }] })                // MAX(issue_number)
      .mockResolvedValueOnce({ rows: [] })                              // UPDATE issue_key
      .mockResolvedValueOnce({ rows: [{ ...createdRow, issue_key: 'NIM-1', issue_number: 1 }] }) // re-resolve
      .mockResolvedValueOnce({ rows: [{ ...createdRow, issue_key: 'NIM-1', issue_number: 1 }] }); // notifyTrackerItemAdded
  }

  it('does NOT auto-link the current session when linkSession is omitted', async () => {
    setupCreateQueueWithoutLink();

    const result = await handleTrackerCreate(
      { type: 'bug', title: 'Some bug' },
      '/tmp/ws',
      'session_abc',
    );

    expect(result.isError).toBe(false);
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('UPDATE ai_sessions'))).toBe(false);
    expect(sqls.some((s) => s.includes('SELECT metadata FROM ai_sessions'))).toBe(false);
  });

  it('links the current session when linkSession: true', async () => {
    const createdRow = makeRow({
      id: 'bug_test',
      workspace: '/tmp/ws',
      issue_key: null,
      issue_number: null,
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                              // INSERT
      .mockResolvedValueOnce({ rows: [createdRow] })                    // resolve created
      .mockResolvedValueOnce({ rows: [{ max_num: 0 }] })                // MAX(issue_number)
      .mockResolvedValueOnce({ rows: [] })                              // UPDATE issue_key
      .mockResolvedValueOnce({ rows: [{ ...createdRow, issue_key: 'NIM-1', issue_number: 1 }] }) // re-resolve
      // createBidirectionalLink:
      .mockResolvedValueOnce({ rows: [{ data: {} }] })                  // SELECT data FROM tracker_items
      .mockResolvedValueOnce({ rows: [] })                              // UPDATE tracker_items
      .mockResolvedValueOnce({ rows: [{ metadata: {} }] })              // SELECT metadata FROM ai_sessions
      .mockResolvedValueOnce({ rows: [] })                              // UPDATE ai_sessions
      // notifySessionLinkedTrackerChanged read:
      .mockResolvedValueOnce({ rows: [{ metadata: { linkedTrackerItemIds: ['bug_test'] } }] })
      // notifyTrackerItemAdded:
      .mockResolvedValueOnce({ rows: [{ ...createdRow, issue_key: 'NIM-1', issue_number: 1 }] });

    const result = await handleTrackerCreate(
      { type: 'bug', title: 'Some bug', linkSession: true },
      '/tmp/ws',
      'session_abc',
    );

    expect(result.isError).toBe(false);
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('UPDATE ai_sessions'))).toBe(true);
  });

  it('does NOT link when linkSession: true but no session is active', async () => {
    setupCreateQueueWithoutLink();

    const result = await handleTrackerCreate(
      { type: 'bug', title: 'Some bug', linkSession: true },
      '/tmp/ws',
      undefined,
    );

    expect(result.isError).toBe(false);
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('UPDATE ai_sessions'))).toBe(false);
  });
});
