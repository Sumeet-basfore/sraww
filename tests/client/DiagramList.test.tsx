// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramList } from '../../src/client/diagrams/DiagramList.tsx';

// The map form has its own tests; here it is stubbed so only the diagram list is exercised.
vi.mock('../../src/client/arch/ArchNewForm.tsx', () => ({ ArchNewForm: () => null }));

// The map form has its own tests; here it is stubbed so only the diagram list is exercised.

const fetchMock = vi.fn();

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
    fetchMock.mockResolvedValueOnce(json(500, { error: 'disk unavailable' }));
    render(<DiagramList onOpen={() => undefined} onOpenArchitecture={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('disk unavailable');
  });

  it('creates a diagram and opens it', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { diagrams: [] })) // initial list
      .mockResolvedValueOnce(json(201, { name: 'Flow' })) // create
      .mockResolvedValue(json(200, { diagrams: [] }));
    const onOpen = vi.fn();
    render(<DiagramList onOpen={onOpen} onOpenArchitecture={() => undefined} />);
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Name a new diagram'), '  Flow  ');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('Flow'));
    const createCall = fetchMock.mock.calls[1];
    expect(JSON.parse(createCall?.[1]?.body as string)).toEqual({ name: 'Flow' });
  });

  it('asks before deleting and does nothing when cancelled', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { diagrams: [{ name: 'keep', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 1 }] }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DiagramList onOpen={() => undefined} onOpenArchitecture={() => undefined} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deletes after confirmation and refreshes the list', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          diagrams: [{ name: 'gone', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 1 }],
        }),
      )
      .mockResolvedValueOnce(json(204))
      .mockResolvedValueOnce(json(200, { diagrams: [] }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DiagramList onOpen={() => undefined} onOpenArchitecture={() => undefined} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/No diagrams yet/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('imports a drawing under a free name when the name is taken', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          diagrams: [{ name: 'Sketch', updatedAt: '2026-01-01T00:00:00Z', sizeBytes: 1 }],
        }),
      )
      .mockResolvedValueOnce(json(201, { name: 'Sketch (2)' }))
      .mockResolvedValue(json(200, { diagrams: [] }));
    const onOpen = vi.fn();
    render(<DiagramList onOpen={onOpen} onOpenArchitecture={() => undefined} />);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Delete' });
    const input = screen.getByLabelText('Choose a drawing to import');
    const file = new File(
      [JSON.stringify({ type: 'excalidraw', elements: [] })],
      'Sketch.excalidraw',
    );
    await user.upload(input, file);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('Sketch (2)'));
    const createCall = fetchMock.mock.calls[1];
    expect(JSON.parse(createCall?.[1]?.body as string).name).toBe('Sketch (2)');
  });
});
