// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/client/App.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));
vi.mock('@excalidraw/excalidraw/index.css', () => ({}));

const fetchMock = vi.fn();

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ diagrams: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the diagram list on the start page', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Diagrams' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No diagrams yet/i)).toBeInTheDocument());
  });

  it('lists saved diagrams and opens one on click', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          diagrams: [{ name: 'system', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 10 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(<App />);
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(await screen.findByRole('button', { name: 'system' }));
    expect(window.location.hash).toBe('#/diagram/system');
  });
});
