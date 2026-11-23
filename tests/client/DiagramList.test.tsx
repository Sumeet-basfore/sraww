// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramList } from '../../src/client/diagrams/DiagramList.tsx';

// The map form has its own tests; here it is stubbed so only the diagram list is exercised.
vi.mock('../../src/client/arch/ArchNewForm.tsx', () => ({ ArchNewForm: () => null }));

const fetchMock = vi.fn();

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The code-projects list loads on mount too; these tests look only at diagram requests. */
function isProjectsRequest(url: unknown): boolean {
  return String(url).startsWith('/api/projects');
}

function diagramCalls(): Array<[string, RequestInit?]> {
  return fetchMock.mock.calls.filter(([url]) => !isProjectsRequest(url)) as Array<
    [string, RequestInit?]
  >;
}

/** Answers the diagram requests in order; later ones get an empty list. */
function queueDiagramResponses(...responses: Response[]): void {
  const queue = [...responses];
  fetchMock.mockImplementation(async (url: unknown) => {
    if (isProjectsRequest(url)) return json(200, { projects: [] });
    return queue.shift() ?? json(200, { diagrams: [] });
  });
}

function renderList(onOpen: (name: string) => void = () => undefined) {
  return render(
    <DiagramList onOpen={onOpen} onOpenArchitecture={() => undefined} onOpenAi={() => undefined} />,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DiagramList', () => {
  it('shows the server error when the list cannot be loaded', async () => {
    queueDiagramResponses(json(500, { error: 'disk unavailable' }));
    renderList();
    expect(await screen.findByRole('alert')).toHaveTextContent('disk unavailable');
  });

  it('creates a diagram and opens it', async () => {
    queueDiagramResponses(
      json(200, { diagrams: [] }), // initial list
      json(201, { name: 'Flow' }), // create
    );
    const onOpen = vi.fn();
    renderList(onOpen);
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Name a new drawing'), '  Flow  ');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('Flow'));
    const createCall = diagramCalls()[1];
    expect(JSON.parse(createCall?.[1]?.body as string)).toEqual({ name: 'Flow' });
  });

  it('asks before deleting and does nothing when cancelled', async () => {
    queueDiagramResponses(
      json(200, { diagrams: [{ name: 'keep', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 1 }] }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderList();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(diagramCalls()).toHaveLength(1);
  });

  it('deletes after confirmation and refreshes the list', async () => {
    queueDiagramResponses(
      json(200, {
        diagrams: [{ name: 'gone', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 1 }],
      }),
      json(204),
      json(200, { diagrams: [] }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderList();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Nothing drawn yet/i)).toBeInTheDocument();
    expect(diagramCalls()[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('imports a drawing under a free name when the name is taken', async () => {
    queueDiagramResponses(
      json(200, {
        diagrams: [{ name: 'Sketch', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 1 }],
      }),
      json(201, { name: 'Sketch (2)' }),
    );
    const onOpen = vi.fn();
    renderList(onOpen);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Delete' });
    const input = screen.getByLabelText('Choose a drawing to import');
    const file = new File(
      [JSON.stringify({ type: 'excalidraw', elements: [] })],
      'Sketch.excalidraw',
    );
    await user.upload(input, file);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('Sketch (2)'));
    const createCall = diagramCalls()[1];
    expect(JSON.parse(createCall?.[1]?.body as string).name).toBe('Sketch (2)');
  });

  it('shows the code-projects section above the map form', async () => {
    queueDiagramResponses(json(200, { diagrams: [] }));
    renderList();
    expect(
      await screen.findByRole('heading', { name: 'Code projects', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload a project folder' })).toBeDisabled();
  });
});
