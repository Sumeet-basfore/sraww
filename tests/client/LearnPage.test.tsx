// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnPage } from '../../src/client/learn/LearnPage.tsx';

const fetchMock = vi.fn();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function providersReply(defaultProvider: 'claude' | 'codex'): Response {
  return json(200, {
    defaultProvider,
    providers: [
      { id: 'claude', label: 'Claude Code', installed: true, loggedIn: true },
      { id: 'codex', label: 'Codex', installed: true, loggedIn: true },
    ],
  });
}

/** Answers the AI tools check with the given default, and the lesson request with `learn`. */
function serve(defaultProvider: 'claude' | 'codex', learn: () => Promise<Response>): void {
  fetchMock.mockImplementation((url: string) =>
    url.includes('/api/ai/providers') ? Promise.resolve(providersReply(defaultProvider)) : learn(),
  );
}

function lessonRequests(): unknown[][] {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/learn/lessons');
}

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('fetch', fetchMock);
  serve('claude', () =>
    Promise.resolve(json(201, { lesson: { id: 'lesson-1' }, skippedSources: 0 })),
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('LearnPage', () => {
  it('shows the Learn heading with the Learn tab marked current', () => {
    render(<LearnPage onShowTour={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Learn', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists the four top-level tabs in order', () => {
    render(<LearnPage onShowTour={() => undefined} />);
    const tabs = screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a');
    expect([...tabs].map((tab) => tab.textContent)).toEqual([
      'Drawings',
      'Learn',
      'Architecture',
      'AI tools',
    ]);
  });

  it('the Take the tour button calls onShowTour', async () => {
    const onShowTour = vi.fn();
    render(<LearnPage onShowTour={onShowTour} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(onShowTour).toHaveBeenCalledTimes(1);
  });

  it('keeps Build lesson disabled until the topic has text other than spaces', async () => {
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText('Topic');
    const button = screen.getByRole('button', { name: 'Build lesson' });
    expect(input).toHaveAttribute('placeholder', 'For example: How HTTP caching works');
    expect(button).toBeDisabled();

    await user.type(input, '   ');
    expect(button).toBeDisabled();

    await user.type(input, 'HTTP caching');
    expect(button).toBeEnabled();
  });

  it('posts the trimmed topic and moves to the lesson once it is built', async () => {
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), '  How HTTP caching works  ');
    await user.click(screen.getByRole('button', { name: 'Build lesson' }));

    await waitFor(() => expect(window.location.hash).toBe('#/learn/lesson-1'));
    expect(lessonRequests()).toHaveLength(1);
    expect(lessonRequests()[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"topic":"How HTTP caching works"}',
    });
  });

  it('locks the form and says the lesson is being built while the request runs', async () => {
    serve('claude', () => new Promise<Response>(() => undefined));
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), 'HTTP caching');
    await user.click(screen.getByRole('button', { name: 'Build lesson' }));

    expect(
      await screen.findByText(
        'Building the lesson. This can take a minute or two. Keep this tab open.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Build lesson' })).toBeDisabled();
  });

  it('shows the server message in an alert and keeps the form usable to try again', async () => {
    serve('claude', () =>
      Promise.resolve(json(500, { error: 'The web pages could not be read.' })),
    );
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), 'HTTP caching');
    await user.click(screen.getByRole('button', { name: 'Build lesson' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The web pages could not be read.');
    expect(screen.getByLabelText('Topic')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Build lesson' })).toBeEnabled();
    expect(window.location.hash).toBe('');
  });

  it('explains that lessons need Claude Code and disables the form when Codex is the default', async () => {
    serve('codex', () => Promise.resolve(json(201, {})));
    render(<LearnPage onShowTour={() => undefined} />);

    expect(
      await screen.findByText('Lessons use Claude Code. Choose Claude Code under AI tools.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Build lesson' })).toBeDisabled();
  });
});
