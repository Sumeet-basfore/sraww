// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '../../src/client/editor/Editor.tsx';
import { canvasProps } from '../mocks/excalidraw.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));
vi.mock('@excalidraw/excalidraw/index.css', () => ({}));

const fetchMock = vi.fn();
const SCENE = {
  type: 'excalidraw',
  version: 2,
  source: 'sraww',
  elements: [{ id: 'r1', type: 'rectangle', version: 1, versionNonce: 7 }],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
};

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  canvasProps.current = null;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

async function openEditor(onExit = vi.fn()) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return json(200, { ok: true });
    if (url === '/api/ai/providers') return json(200, { defaultProvider: 'claude', providers: [] });
    if (url === '/api/library') return json(200, { items: [] });
    return json(200, SCENE);
  });
  render(<Editor name="notes" onExit={onExit} />);
  await screen.findByTestId('excalidraw-canvas');
  return onExit;
}

describe('Editor', () => {
  it('loads the diagram and shows it saved', async () => {
    await openEditor();
    expect(screen.getByRole('heading', { name: 'notes' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('All changes saved');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/diagrams/notes');
  });

  it('does not save when Excalidraw reports the same elements again', async () => {
    await openEditor();
    act(() => {
      canvasProps.current?.onChange?.(SCENE.elements, { viewBackgroundColor: '#ffffff' }, {});
    });
    await new Promise((r) => setTimeout(r, 1000));
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(false);
  });

  it('saves after an edit, and only the changed scene is sent', async () => {
    await openEditor();
    const edited = [{ id: 'r1', type: 'rectangle', version: 2, versionNonce: 9 }];
    act(() => {
      canvasProps.current?.onChange?.(edited, { viewBackgroundColor: '#ffffff' }, {});
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All changes saved'), {
      timeout: 3000,
    });
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT');
    expect(put?.[0]).toBe('/api/diagrams/notes');
    expect(JSON.parse(put?.[1]?.body as string).elements).toEqual(edited);
  });

  it('shows a retry button when saving fails', async () => {
    await openEditor();
    fetchMock.mockImplementation(async () => json(500, { error: 'disk full' }));
    act(() => {
      canvasProps.current?.onChange?.(
        [{ id: 'r1', type: 'rectangle', version: 5, versionNonce: 1 }],
        { viewBackgroundColor: '#ffffff' },
        {},
      );
    });
    expect(await screen.findByRole('button', { name: 'Retry' }, { timeout: 3000 })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Not saved');
  });

  it('saves pending changes and then leaves when going back', async () => {
    const onExit = await openEditor();
    act(() => {
      canvasProps.current?.onChange?.(
        [{ id: 'r1', type: 'rectangle', version: 3, versionNonce: 3 }],
        { viewBackgroundColor: '#ffffff' },
        {},
      );
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back to diagrams' }));
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(true);
  });

  it('shows the error and stays put when the diagram cannot be opened', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { error: 'Diagram "notes" not found.' }));
    render(<Editor name="notes" onExit={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('not found');
  });
});
