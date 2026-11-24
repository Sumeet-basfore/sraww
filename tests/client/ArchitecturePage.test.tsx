// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchitecturePage } from '../../src/client/arch/ArchitecturePage.tsx';

const fetchMock = vi.fn();

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockImplementation(async (url: unknown) => {
    const path = String(url);
    if (path.startsWith('/api/diagrams')) return json({ diagrams: [] });
    if (path.startsWith('/api/ai/providers')) {
      return json({ defaultProvider: 'claude', providers: [] });
    }
    return json({ projects: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('ArchitecturePage', () => {
  it('holds the code projects and the map form, with the Architecture tab marked current', async () => {
    render(<ArchitecturePage onOpenArchitecture={() => undefined} onShowTour={() => undefined} />);
    expect(
      await screen.findByRole('heading', { name: 'Architecture', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Architecture' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Drawings' })).not.toHaveAttribute('aria-current');
    expect(
      await screen.findByRole('heading', { name: 'Code projects', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Map a project' })).toBeInTheDocument();
  });

  it('enables the upload button only after the privacy notice is ticked', async () => {
    render(<ArchitecturePage onOpenArchitecture={() => undefined} onShowTour={() => undefined} />);
    const upload = await screen.findByRole('button', { name: 'Upload a project folder' });
    expect(upload).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('checkbox', { name: /I understand/ }));
    expect(upload).toBeEnabled();
  });

  it('the Take the tour button calls onShowTour', async () => {
    const onShowTour = vi.fn();
    render(<ArchitecturePage onOpenArchitecture={() => undefined} onShowTour={onShowTour} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Take the tour' }));
    expect(onShowTour).toHaveBeenCalledTimes(1);
  });
});
