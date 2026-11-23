// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FindingsSection } from '../../src/client/arch/FindingsSection.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

const fetchMock = vi.fn();
const findings = [
  {
    id: 'cycle:a,b',
    kind: 'cycle',
    severity: 'high',
    title: 'Dependency cycle',
    detail: 'A and B depend on each other.',
    nodes: ['a', 'b'],
  },
  {
    id: 'orphan:c',
    kind: 'orphan',
    severity: 'low',
    title: 'Isolated component',
    detail: 'C has no connections.',
    nodes: ['c'],
  },
] as const;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockResolvedValue(json({ findings }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('FindingsSection', () => {
  it('renders findings with severity counts', async () => {
    render(
      <FindingsSection
        name="demo"
        getApi={() => null}
        selectedIds={[]}
        nodeLabels={{ a: 'Folder A', b: 'Folder B', c: 'Folder C' }}
      />,
    );

    expect(await screen.findByText('Dependency cycle')).toBeInTheDocument();
    expect(screen.getByText('A and B depend on each other.')).toBeInTheDocument();
    expect(screen.getByText('Isolated component')).toBeInTheDocument();
    expect(screen.getByText('Folder A, Folder B')).toBeInTheDocument();
    expect(screen.getByLabelText('High 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Low 1')).toBeInTheDocument();
  });

  it('selects the finding nodes through the scene update path when clicked', async () => {
    const updateScene = vi.fn();
    const getApi = () => ({ updateScene }) as never;
    render(<FindingsSection name="demo" getApi={getApi} selectedIds={[]} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Show Dependency cycle on map' }));

    expect(updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        appState: { selectedElementIds: { 'node:a': true, 'node:b': true } },
      }),
    );
  });

  it('refreshes the findings when the map revision changes', async () => {
    const props = {
      name: 'demo',
      getApi: () => null,
      selectedIds: [] as string[],
      refreshKey: 'first scan',
    };
    const { rerender } = render(<FindingsSection {...props} />);
    await screen.findByText('Dependency cycle');

    rerender(<FindingsSection {...props} refreshKey="second scan" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
