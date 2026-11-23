// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../../src/client/ai/ChatPanel.tsx';
import { PROVIDERS, json } from './ai-fixtures.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

const fetchMock = vi.fn();

function fakeApi(selected: string[] = []) {
  return {
    getAppState: vi.fn(() => ({
      selectedElementIds: Object.fromEntries(selected.map((id) => [id, true])),
    })),
    getSceneElements: vi.fn(() => [{ id: 'api', type: 'rectangle' }]),
    getSceneElementsIncludingDeleted: vi.fn(() => [
      { id: 'api', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
    ]),
    updateScene: vi.fn(),
  };
}

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/ai/providers') return json(PROVIDERS);
    if (url === '/api/ai/chat')
      return json({
        provider: 'claude',
        reply: 'Added a cache.',
        ops: [{ type: 'addNodes', nodes: [{ id: 'cache', label: 'Cache' }] }],
        rejected: ['Cannot delete "ghost": no such shape in the diagram.'],
      });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('ChatPanel', () => {
  it('applies the reply’s edits and lists rejected ones as notes', async () => {
    const api = fakeApi();
    render(<ChatPanel getApi={() => api as never} onClose={() => undefined} />);
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Ask for a change…'), 'Add a cache');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Added a cache.')).toBeInTheDocument();
    expect(screen.getByText(/1 change\(s\) applied/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot delete "ghost"/)).toBeInTheDocument();
    await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));
  });

  it('explains a selection without changing the drawing', async () => {
    const api = fakeApi(['api']);
    render(<ChatPanel getApi={() => api as never} onClose={() => undefined} />);
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain selection' }));

    expect(await screen.findByText('No changes made.')).toBeInTheDocument();
    expect(api.updateScene).not.toHaveBeenCalled();
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/ai/chat');
    const body = JSON.parse(call?.[1]?.body as string);
    expect(body.summary.shapes.map((s: { id: string }) => s.id)).toEqual(['api']);
    expect(body.provider).toBe('claude');
  });

  it('asks for a selection before explaining', async () => {
    const api = fakeApi([]);
    render(<ChatPanel getApi={() => api as never} onClose={() => undefined} />);
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain selection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select one or more shapes');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/ai/chat')).toBe(false);
  });
});
