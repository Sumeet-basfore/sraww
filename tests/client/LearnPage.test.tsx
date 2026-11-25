// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const SAVED = [
  { id: 'course-2', title: 'TCP handshakes', createdAt: '2026-11-20T09:00:00.000Z', topicCount: 4 },
  { id: 'course-1', title: 'HTTP caching', createdAt: '2026-11-24T10:00:00.000Z', topicCount: 3 },
];

function serve(courses: unknown[], create: () => Promise<Response>): void {
  fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? create() : Promise.resolve(json(200, { courses })),
  );
}

function postRequests(): unknown[][] {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
  );
}

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('fetch', fetchMock);
  serve([], () => Promise.resolve(json(201, { course: { id: 'course-9' } })));
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

  it('keeps Build course disabled until the topic has text other than spaces', async () => {
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText('Topic');
    const button = screen.getByRole('button', { name: 'Build course' });
    expect(input).toHaveAttribute('placeholder', 'For example: How HTTP caching works');
    expect(button).toBeDisabled();

    await user.type(input, '   ');
    expect(button).toBeDisabled();

    await user.type(input, 'HTTP caching');
    expect(button).toBeEnabled();
  });

  it('posts the trimmed topic and moves to the course once its outline is built', async () => {
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), '  How HTTP caching works  ');
    await user.click(screen.getByRole('button', { name: 'Build course' }));

    await waitFor(() => expect(window.location.hash).toBe('#/course/course-9'));
    expect(postRequests()).toHaveLength(1);
    expect(postRequests()[0]).toEqual([
      '/api/learn/courses',
      expect.objectContaining({ method: 'POST', body: '{"topic":"How HTTP caching works"}' }),
    ]);
  });

  it('says the outline is being built and locks the form while the request runs', async () => {
    serve([], () => new Promise<Response>(() => undefined));
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), 'HTTP caching');
    await user.click(screen.getByRole('button', { name: 'Build course' }));

    expect(
      await screen.findByText('Building the course outline. Keep this tab open.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Build course' })).toBeDisabled();
  });

  it('says a course outline can take a minute or more, and that lessons take longer', () => {
    render(<LearnPage onShowTour={() => undefined} />);

    expect(
      screen.getByText(
        'Building a course outline can take a minute or more. Building a lesson uses web research, which can take longer.',
      ),
    ).toBeInTheDocument();
  });

  it('lists saved courses with their titles and creation dates', async () => {
    serve(SAVED, () => Promise.resolve(json(201, {})));
    render(<LearnPage onShowTour={() => undefined} />);

    const link = await screen.findByRole('link', { name: 'HTTP caching' });
    expect(link).toHaveAttribute('href', '#/course/course-1');
    const row = link.closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Nov 24, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TCP handshakes' })).toHaveAttribute(
      'href',
      '#/course/course-2',
    );
  });

  it('says there are no courses yet when none are saved', async () => {
    render(<LearnPage onShowTour={() => undefined} />);
    expect(await screen.findByText('No courses yet. Build one above.')).toBeInTheDocument();
  });

  it('shows a server error in an alert and keeps the form usable to try again', async () => {
    serve([], () => Promise.resolve(json(502, { error: 'The AI tool did not answer.' })));
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), 'HTTP caching');
    await user.click(screen.getByRole('button', { name: 'Build course' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI tool did not answer.');
    expect(screen.getByLabelText('Topic')).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Try again: build the course outline' }),
    ).toBeEnabled();
    expect(window.location.hash).toBe('');
  });

  it('typing a new topic after a failed build clears the alert and restores Build course', async () => {
    serve([], () => Promise.resolve(json(502, { error: 'The AI tool did not answer.' })));
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), 'HTTP caching');
    await user.click(screen.getByRole('button', { name: 'Build course' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Topic'), 'x');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Build course' })).toBeEnabled();
  });

  it('Try again posts the same topic again after a failed build, and moves to the course', async () => {
    let posts = 0;
    serve([], () => {
      posts += 1;
      return Promise.resolve(
        posts === 1
          ? json(502, { error: 'The AI tool did not answer.' })
          : json(201, { course: { id: 'course-9' } }),
      );
    });
    render(<LearnPage onShowTour={() => undefined} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Topic'), 'HTTP caching');
    await user.click(screen.getByRole('button', { name: 'Build course' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The AI tool did not answer.');

    await user.click(screen.getByRole('button', { name: 'Try again: build the course outline' }));

    await waitFor(() => expect(window.location.hash).toBe('#/course/course-9'));
    expect(postRequests()).toHaveLength(2);
    expect(postRequests()[1]).toEqual([
      '/api/learn/courses',
      expect.objectContaining({ method: 'POST', body: '{"topic":"HTTP caching"}' }),
    ]);
  });

  it('a course list that fails to load can be tried again without reloading the page', async () => {
    let listings = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(json(201, {}));
      listings += 1;
      return Promise.resolve(
        listings === 1
          ? json(500, { error: 'The course list could not be read.' })
          : json(200, { courses: SAVED }),
      );
    });
    render(<LearnPage onShowTour={() => undefined} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The course list could not be read.',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again: load your courses' }));

    expect(await screen.findByRole('link', { name: 'HTTP caching' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(listings).toBe(2);
  });
});
