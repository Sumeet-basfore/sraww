// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchPanel } from '../../src/client/arch/ArchPanel.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));
vi.mock('../../src/client/arch/to-scene.ts', () => ({
  architectureElements: vi.fn(async () => []),
}));

const MODEL = {
  version: 1,
  projectId: 'demo',
  sourceLabel: 'demo',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    { id: 'src', label: 'src', kind: 'component', group: 'src', files: 1, members: ['src/app.ts'] },
    { id: 'ext:express', label: 'express', kind: 'external', group: null, files: 0, members: [] },
  ],
  edges: [{ from: 'src', to: 'ext:express', count: 1 }],
  groups: [{ id: 'src', label: 'src', members: ['src'] }],
};

const FINDINGS = [
  {
    id: 'orphan:src',
    kind: 'orphan',
    severity: 'low',
    title: 'Isolated component',
    detail: 'src has no connections.',
    nodes: ['src'],
  },
];

const fetchMock = vi.fn();

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeApi() {
  return {
    getAppState: vi.fn(() => ({ selectedElementIds: {} })),
    onChange: vi.fn(() => () => undefined),
    getSceneElements: vi.fn(() => []),
    getSceneElementsIncludingDeleted: vi.fn(() => []),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
  };
}

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/name') && init?.method === 'POST') return json({ model: MODEL, applied: 1 });
    if (url.includes('/layout') && init?.method === 'PUT') return json({ ok: true });
    if (url.endsWith('/findings')) return json({ findings: FINDINGS });
    return json({ model: MODEL, layout: null });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ArchPanel', () => {
  it('shows the project chip and all four workspace metrics once data has loaded', async () => {
    render(<ArchPanel name="demo" getApi={() => fakeApi() as never} onClose={() => undefined} />);
    expect(await screen.findByText('demo')).toBeInTheDocument();
    expect(screen.getByText('Folders').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Packages').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Dependencies').nextSibling).toHaveTextContent('1');
    expect(await screen.findByText('Orphans')).toBeInTheDocument();
    expect(screen.getByText('Orphans').nextSibling).toHaveTextContent('1');
  });

  it('can collapse and expand the inspector sheet', async () => {
    render(<ArchPanel name="demo" getApi={() => fakeApi() as never} onClose={() => undefined} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Collapse inspector' }));
    expect(screen.getByRole('button', { name: 'Expand inspector' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.querySelector('.arch-panel')).toHaveClass('is-collapsed');

    await user.click(screen.getByRole('button', { name: 'Expand inspector' }));
    expect(screen.getByRole('button', { name: 'Collapse inspector' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('names components with AI after saving the current layout, and reports that links were kept', async () => {
    render(<ArchPanel name="demo" getApi={() => fakeApi() as never} onClose={() => undefined} />);
    const user = userEvent.setup();
    await screen.findByText('demo');
    await user.click(screen.getByRole('button', { name: 'Name with AI' }));

    expect(await screen.findByText(/Named 1 folder\(s\) with AI/)).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map((c) => `${c[1]?.method ?? 'GET'} ${c[0]}`);
    const saved = urls.indexOf('PUT /api/arch/models/demo/layout');
    const named = urls.indexOf('POST /api/arch/models/demo/name');
    expect(saved).toBeGreaterThanOrEqual(0);
    expect(named).toBeGreaterThan(saved);
  });

  it('explains when a re-scan has no project to read from', async () => {
    fetchMock.mockImplementation(async () =>
      json({ model: { ...MODEL, projectId: undefined }, layout: null }),
    );
    render(<ArchPanel name="demo" getApi={() => fakeApi() as never} onClose={() => undefined} />);
    const user = userEvent.setup();
    await screen.findByText('demo');
    await user.click(screen.getByRole('button', { name: 'Re-scan' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('no project to scan'));
  });
});
