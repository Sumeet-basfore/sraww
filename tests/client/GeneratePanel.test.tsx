// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratePanel } from '../../src/client/ai/GeneratePanel.tsx';
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
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/ai/providers') return json(PROVIDERS);
    if (url === '/api/ai/generate') return json({ provider: 'claude', graph: GRAPH });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function fakeApi() {
  return {
    getSceneElementsIncludingDeleted: vi.fn(() => [{ id: 'existing' }]),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
  };
}

describe('GeneratePanel', () => {
  it('shows the tool, model and effort it will use, and enables Generate once a prompt is typed', async () => {
    render(<GeneratePanel getApi={() => null} onClose={() => undefined} />);
    expect(await screen.findByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Opus · high effort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Describe the diagram'), 'An API and its database');
    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
  });

  it('explains which sign-in is missing when the default tool is not signed in', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/ai/providers'
        ? json({ ...PROVIDERS, defaultProvider: 'codex' })
        : new Response(null, { status: 404 }),
    );
    render(<GeneratePanel getApi={() => null} onClose={() => undefined} />);
    expect(await screen.findByText(/Codex is not ready/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Describe the diagram'), 'An API and its database');
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  });

  it('shows a summary of the generated diagram and adds it to the drawing', async () => {
    const api = fakeApi();
    const onClose = vi.fn();
    render(<GeneratePanel getApi={() => api as never} onClose={onClose} />);
    const user = userEvent.setup();
    await screen.findByText('Claude Code');
    await user.type(screen.getByLabelText('Describe the diagram'), 'An API and its database');
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByText(/2 shapes and 1 connections/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to drawing' }));

    await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));
    const update = api.updateScene.mock.calls[0]?.[0] as {
      elements: unknown[];
      captureUpdate: string;
    };
    // One existing element kept, plus two shapes and one arrow created from the graph.
    expect(update.elements).toHaveLength(4);
    expect(update.captureUpdate).toBe('IMMEDIATELY');
    expect(onClose).toHaveBeenCalled();
  });

  it('sends the default tool and the prompt to the server', async () => {
    render(<GeneratePanel getApi={() => null} onClose={() => undefined} />);
    const user = userEvent.setup();
    await screen.findByText('Claude Code');
    await user.type(screen.getByLabelText('Describe the diagram'), '  Login flow  ');
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByText(/shapes and/);
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/ai/generate');
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({
      prompt: 'Login flow',
      provider: 'claude',
    });
  });

  it('shows the server message when generation fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/ai/providers') return json(PROVIDERS);
      return new Response(JSON.stringify({ error: 'Usage limit reached.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<GeneratePanel getApi={() => null} onClose={() => undefined} />);
    const user = userEvent.setup();
    await screen.findByText('Claude Code');
    await user.type(screen.getByLabelText('Describe the diagram'), 'Login flow');
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usage limit reached.');
  });
});
