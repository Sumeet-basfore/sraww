// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from '../../src/client/ai/assistant/Assistant.tsx';
import { PROVIDERS, json } from './ai-fixtures.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));
vi.mock('../../src/client/ai/layout.ts', () => ({
  layoutGraph: vi.fn(async () => ({
    boxes: new Map([
      ['api', { x: 0, y: 0, width: 140, height: 72 }],
      ['db', { x: 0, y: 150, width: 140, height: 72 }],
    ]),
    frames: new Map(),
  })),
}));

const GRAPH = {
  nodes: [
    { id: 'api', label: 'API' },
    { id: 'db', label: 'Database' },
  ],
  edges: [{ from: 'api', to: 'db' }],
  direction: null,
  title: null,
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/ai/providers') return json(PROVIDERS);
    if (url === '/api/ai/generate') return json({ provider: 'claude', graph: GRAPH });
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
    scrollToContent: vi.fn(),
  };
}

function renderAssistant(api: object, open = true) {
  return render(<Assistant getApi={() => api as never} open={open} onToggle={() => undefined} />);
}

describe('Assistant', () => {
  it('shows the tool it will use and offers both modes in one place', async () => {
    renderAssistant(fakeApi());
    expect(await screen.findByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'What the assistant does' })).toBeInTheDocument();
  });

  it('sends an edit with the drawing, and applies the reply’s changes', async () => {
    const api = fakeApi();
    renderAssistant(api);
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Message the assistant'), 'Add a cache');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Added a cache.')).toBeInTheDocument();
    expect(screen.getByText(/1 change\(s\) applied/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot delete "ghost"/)).toBeInTheDocument();
    await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));
  });

  it('sends with Enter, and keeps Shift+Enter for a new line', async () => {
    renderAssistant(fakeApi());
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    const box = screen.getByLabelText('Message the assistant');
    await user.type(box, 'First{Shift>}{Enter}{/Shift}second');
    expect(box).toHaveValue('First\nsecond');
    await user.type(box, '{Enter}');
    await screen.findByText('Added a cache.');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/ai/chat')).toBe(true);
  });

  it('proposes a new diagram in “New diagram” mode and adds it on request', async () => {
    const api = fakeApi();
    renderAssistant(api);
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'What the assistant does' }),
      'new',
    );
    await user.type(screen.getByLabelText('Message the assistant'), 'An API and its database');
    await user.click(screen.getByRole('button', { name: 'Generate diagram' }));

    expect(await screen.findByText(/2 shapes and 1 connections/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to drawing' }));
    await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Added to the drawing.')).toBeInTheDocument();
  });

  it('asks for a selection before explaining', async () => {
    renderAssistant(fakeApi([]));
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain the selected shapes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select one or more shapes');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/ai/chat')).toBe(false);
  });

  it('explains a selection without changing the drawing', async () => {
    const api = fakeApi(['api']);
    renderAssistant(api);
    await screen.findByText('Claude Code');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain the selected shapes' }));
    expect(await screen.findByText('No changes made.')).toBeInTheDocument();
    expect(api.updateScene).not.toHaveBeenCalled();
  });

  it('shows only its bar when collapsed', async () => {
    renderAssistant(fakeApi(), false);
    expect(await screen.findByRole('button', { name: /Assistant/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByLabelText('Message the assistant')).not.toBeInTheDocument();
  });
});
