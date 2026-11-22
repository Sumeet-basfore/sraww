// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/client/App.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));
vi.mock('@excalidraw/excalidraw/index.css', () => ({}));

const fetchMock = vi.fn();

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serve(diagrams: unknown[]): void {
  fetchMock.mockImplementation(async (url: string) =>
    url.includes('/api/arch/projects') ? json({ projects: [] }) : json({ diagrams }),
  );
}

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the diagram list on the start page', async () => {
    serve([]);
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Diagrams' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No diagrams yet/i)).toBeInTheDocument());
  });

  it('lists saved diagrams and opens one on click', async () => {
    serve([{ name: 'system', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 10 }]);
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'system' }));
    expect(window.location.hash).toBe('#/diagram/system');
  });
});
