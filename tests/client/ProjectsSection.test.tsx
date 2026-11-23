// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsSection } from '../../src/client/projects/ProjectsSection.tsx';

const fetchMock = vi.fn();

const PROJECT = {
  id: '6f1c2c9e-0000-4000-8000-000000000001',
  name: 'shop',
  createdAt: '2026-01-02T03:04:05.000Z',
  consentAt: '2026-01-02T03:04:05.000Z',
  fileCount: 3,
  bytes: 1200,
  excluded: [{ path: 'secrets/.env', reason: 'looks like a credential or key file' }],
};

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/projects' && !init?.method) return json(200, { projects: [PROJECT] });
    if (url.startsWith('/api/projects/') && init?.method === 'DELETE') return json(204);
    return json(404, { error: 'not found' });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ProjectsSection', () => {
  it('keeps both upload buttons disabled until the privacy notice is accepted', async () => {
    render(<ProjectsSection onChanged={() => undefined} />);
    const user = userEvent.setup();
    const folder = screen.getByRole('button', { name: 'Upload a project folder' });
    const zip = screen.getByRole('button', { name: 'Upload a zip file' });
    expect(folder).toBeDisabled();
    expect(zip).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(folder).toBeEnabled();
    expect(zip).toBeEnabled();
  });

  it('lists each project with its file count and the files left out, and why', async () => {
    render(<ProjectsSection onChanged={() => undefined} />);
    expect(await screen.findByText('shop')).toBeInTheDocument();
    expect(screen.getByText(/3 files/)).toBeInTheDocument();
    expect(screen.getByText('1 file left out')).toBeInTheDocument();
    expect(screen.getByText('secrets/.env', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText(/looks like a credential or key file/, { exact: false }),
    ).toBeInTheDocument();
  });

  it('deletes a project after confirmation and tells the form to reload', async () => {
    const onChanged = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ProjectsSection onChanged={onChanged} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${PROJECT.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does not delete when the confirmation is declined', async () => {
    const onChanged = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ProjectsSection onChanged={onChanged} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('shows the server error when the list cannot be loaded', async () => {
    fetchMock.mockResolvedValue(json(500, { error: 'store unavailable' }));
    render(<ProjectsSection onChanged={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('store unavailable');
  });
});
