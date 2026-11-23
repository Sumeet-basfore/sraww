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

async function defaultFetchImplementation(url: string): Promise<Response> {
  if (url === '/api/ai/providers') return json(PROVIDERS);
  if (url === '/api/ai/default') return json({ defaultProvider: 'claude' });
  if (url === '/api/ai/providers/claude/selection') return json(PROVIDERS.providers[0]);
  if (url === '/api/ai/generate') return json({ provider: 'claude', graph: GRAPH });
  if (url === '/api/ai/chat')
    return json({
      provider: 'claude',
      reply: 'Added a cache.',
      ops: [{ type: 'addNodes', nodes: [{ id: 'cache', label: 'Cache' }] }],
      rejected: ['Cannot delete "ghost": no such shape in the diagram.'],
    });
  return new Response(null, { status: 404 });
}

beforeEach(() => {
  fetchMock.mockImplementation(defaultFetchImplementation);
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

function renderAssistant(api: object) {
  return render(<Assistant getApi={() => api as never} />);
}

describe('Assistant', () => {
  it('shows the tool, model and effort it will use, and offers both modes in one place', async () => {
    renderAssistant(fakeApi());
    expect(await screen.findByRole('combobox', { name: 'AI tool' })).toHaveValue('claude');
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('opus');
    expect(screen.getByRole('combobox', { name: 'Effort' })).toHaveValue('high');
    expect(screen.getByRole('combobox', { name: 'What the assistant does' })).toBeInTheDocument();
  });

  it('saves a new effort to the same settings the AI tools page uses', async () => {
    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'Effort' });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Effort' }), 'low');

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/providers/claude/selection',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ model: 'opus', effort: 'low' }),
        }),
      ),
    );
  });

  it('blocks sending while a settings save is pending', async () => {
    let resolveSave!: (response: Response) => void;
    const saveResponse = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/ai/providers/claude/selection' && init?.method === 'PUT') {
        return saveResponse;
      }
      return defaultFetchImplementation(url);
    });

    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'Effort' });
    const user = userEvent.setup();
    const messageBox = screen.getByLabelText('Message the assistant');
    await user.type(messageBox, 'Add a cache');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Effort' }), 'low');

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/providers/claude/selection',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Explain selection' })).toBeDisabled();
    expect(messageBox).toBeEnabled();

    await user.type(messageBox, '{Enter}');
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/ai/chat')).toBe(false);

    resolveSave(json(PROVIDERS.providers[0]));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Added a cache.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/ai/chat')).toBe(true);
  });

  it('reenables sending after a settings save fails', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/ai/providers/claude/selection' && init?.method === 'PUT') {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return defaultFetchImplementation(url);
    });

    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'Effort' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Message the assistant'), 'Add a cache');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Effort' }), 'low');

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed with status 500');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  });

  it('keeps saved settings and the composer usable when refreshing providers fails', async () => {
    let providerRequests = 0;
    const savedProvider = {
      ...PROVIDERS.providers[0],
      selection: { model: 'opus', effort: 'low' as const },
    };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/ai/providers') {
        providerRequests += 1;
        return providerRequests === 1
          ? Promise.resolve(json(PROVIDERS))
          : Promise.resolve(new Response(null, { status: 500 }));
      }
      if (url === '/api/ai/providers/claude/selection' && init?.method === 'PUT') {
        return Promise.resolve(json(savedProvider));
      }
      return defaultFetchImplementation(url);
    });

    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'Effort' });
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Effort' }), 'low');

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be refreshed');
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('opus');
    expect(screen.getByRole('combobox', { name: 'Effort' })).toHaveValue('low');
    expect(screen.getByLabelText('Message the assistant')).toBeEnabled();
    expect(providerRequests).toBe(2);
  });

  it('offers only the tools that are signed in', async () => {
    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'AI tool' });
    expect(screen.getByRole('option', { name: 'Codex (not signed in)' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Claude Code' })).toBeEnabled();
  });

  it('shows a provider load error and lets the user retry successfully', async () => {
    let providerRequests = 0;
    let resolveRetry!: (response: Response) => void;
    const retryResponse = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/ai/providers') {
        providerRequests += 1;
        return providerRequests === 1
          ? Promise.resolve(new Response(null, { status: 500 }))
          : retryResponse;
      }
      return defaultFetchImplementation(url);
    });

    renderAssistant(fakeApi());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the AI tools');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('Sign in to an AI tool to start.')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    resolveRetry(json(PROVIDERS));
    expect(await screen.findByRole('combobox', { name: 'Model' })).toBeInTheDocument();
    expect(providerRequests).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the first-load error and Retry control when retrying also fails', async () => {
    let providerRequests = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/ai/providers') {
        providerRequests += 1;
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return defaultFetchImplementation(url);
    });

    renderAssistant(fakeApi());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the AI tools');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the AI tools');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('Sign in to an AI tool to start.')).not.toBeInTheDocument();
    expect(providerRequests).toBe(2);
  });

  it('shows a checking placeholder while providers are loading', async () => {
    let resolveProviders!: (response: Response) => void;
    const providersResponse = new Promise<Response>((resolve) => {
      resolveProviders = resolve;
    });
    fetchMock.mockImplementation((url: string) =>
      url === '/api/ai/providers' ? providersResponse : defaultFetchImplementation(url),
    );

    renderAssistant(fakeApi());
    const messageBox = screen.getByLabelText('Message the assistant');
    expect(messageBox).toHaveAttribute('placeholder', 'Checking AI tools…');
    expect(messageBox).toBeDisabled();

    resolveProviders(json(PROVIDERS));
    expect(await screen.findByRole('combobox', { name: 'Model' })).toBeInTheDocument();
  });

  it('points to the AI tools page when the tool is not signed in', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/ai/providers'
        ? json({ ...PROVIDERS, defaultProvider: 'codex' })
        : new Response(null, { status: 404 }),
    );
    renderAssistant(fakeApi());
    expect(await screen.findByRole('status')).toHaveTextContent('Codex is not ready');
    expect(screen.getByRole('link', { name: 'Open AI tools' })).toBeInTheDocument();
    expect(screen.getByLabelText('Message the assistant')).toBeDisabled();
  });

  it('clears the conversation on request', async () => {
    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'Model' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Message the assistant'), 'Add a cache');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Added a cache.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('Added a cache.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('sends an edit with the drawing, and applies the reply’s changes', async () => {
    const api = fakeApi();
    renderAssistant(api);
    await screen.findByRole('combobox', { name: 'Model' });
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
    await screen.findByRole('combobox', { name: 'Model' });
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
    await screen.findByRole('combobox', { name: 'Model' });
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
    await screen.findByRole('combobox', { name: 'Model' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain selection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select one or more shapes');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/ai/chat')).toBe(false);
  });

  it('explains a selection without changing the drawing', async () => {
    const api = fakeApi(['api']);
    renderAssistant(api);
    await screen.findByRole('combobox', { name: 'Model' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain selection' }));
    expect(await screen.findByText('No changes made.')).toBeInTheDocument();
    expect(api.updateScene).not.toHaveBeenCalled();
  });

  it('shows only the prompt box until there is a conversation', async () => {
    renderAssistant(fakeApi());
    await screen.findByRole('combobox', { name: 'Model' });
    expect(screen.getByLabelText('Message the assistant')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });
});
