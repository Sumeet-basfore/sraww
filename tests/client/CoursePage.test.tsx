// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoursePage } from '../../src/client/learn/CoursePage.tsx';

const fetchMock = vi.fn();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const COURSE = {
  id: 'course-1',
  title: 'HTTP caching',
  prompt: 'HTTP caching',
  createdAt: '2026-11-24T10:00:00.000Z',
  modules: [
    {
      id: 'module-1',
      title: 'Basics',
      topics: [
        { id: 'topic-1', title: 'What a cache is', summary: 'A cache keeps a copy of a response.' },
        { id: 'topic-2', title: 'Freshness', summary: 'A copy stays fresh for a set time.' },
      ],
    },
    {
      id: 'module-2',
      title: 'Checking copies',
      topics: [
        {
          id: 'topic-3',
          title: 'Validators',
          summary: 'A validator asks whether a copy is still good.',
        },
      ],
    },
  ],
};

interface ServeOptions {
  progressTopicId?: string | null;
  builtLessons?: Record<string, string>;
  open?: () => Promise<Response>;
  load?: () => Promise<Response>;
}

/**
 * Serves one course. Opening a topic is answered by `open`, and saving progress returns the
 * course with the saved topic.
 */
function serve(options: ServeOptions = {}): void {
  const progressTopicId = options.progressTopicId ?? null;
  const builtLessons = options.builtLessons ?? {};
  const course = { ...COURSE, progress: { topicId: progressTopicId } };
  const open =
    options.open ??
    (() => Promise.resolve(json(201, { lesson: { id: 'lesson-1' }, skippedSources: 0 })));
  const load = options.load ?? (() => Promise.resolve(json(200, { course, builtLessons })));
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const progress = JSON.parse(String(init.body));
      return Promise.resolve(json(200, { course: { ...course, progress } }));
    }
    if (String(url).endsWith('/lesson')) return open();
    return load();
  });
}

function renderCourse(): void {
  render(<CoursePage id="course-1" onShowTour={() => undefined} />);
}

async function topicRow(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: title, level: 3 });
  return heading.closest('li') as HTMLElement;
}

function callsTo(suffix: string): unknown[][] {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix));
}

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('fetch', fetchMock);
  serve();
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('CoursePage', () => {
  it('shows the course title, each module and its topics with their summaries', async () => {
    renderCourse();

    expect(
      await screen.findByRole('heading', { name: 'HTTP caching', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basics', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Checking copies', level: 2 })).toBeInTheDocument();
    expect(
      within(await topicRow('Freshness')).getByText('A copy stays fresh for a set time.'),
    ).toBeInTheDocument();
    expect(
      within(await topicRow('Validators')).getByText(
        'A validator asks whether a copy is still good.',
      ),
    ).toBeInTheDocument();
  });

  it('links back to the Learn tab', async () => {
    renderCourse();
    expect(await screen.findByRole('link', { name: '← Learn' })).toHaveAttribute('href', '#/learn');
  });

  it('marks topics with a built lesson Ready and the others Not built yet', async () => {
    serve({ builtLessons: { 'topic-1': 'lesson-7' } });
    renderCourse();

    expect(within(await topicRow('What a cache is')).getByText('Ready')).toBeInTheDocument();
    expect(within(await topicRow('Freshness')).getByText('Not built yet')).toBeInTheDocument();
  });

  it('opening a topic builds its lesson, saves progress, then shows the lesson', async () => {
    renderCourse();
    const user = userEvent.setup();
    await user.click(
      within(await topicRow('Freshness')).getByRole('button', { name: 'Open lesson' }),
    );

    await waitFor(() => expect(window.location.hash).toBe('#/learn/lesson-1'));
    const [open] = callsTo('/topics/topic-2/lesson');
    expect(open?.[1]).toMatchObject({ method: 'POST' });
    const [progress] = callsTo('/progress');
    expect(progress?.[0]).toBe('/api/learn/courses/course-1/progress');
    expect(progress?.[1]).toMatchObject({ method: 'PUT', body: '{"topicId":"topic-2"}' });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.indexOf('/api/learn/courses/course-1/topics/topic-2/lesson')).toBeLessThan(
      urls.indexOf('/api/learn/courses/course-1/progress'),
    );
  });

  it('while one topic builds, its button says so and every other open button waits', async () => {
    serve({ open: () => new Promise<Response>(() => undefined) });
    renderCourse();
    const user = userEvent.setup();
    await user.click(
      within(await topicRow('Freshness')).getByRole('button', { name: 'Open lesson' }),
    );

    expect(
      await within(await topicRow('Freshness')).findByRole('button', {
        name: 'Building the lesson…',
      }),
    ).toBeDisabled();
    expect(
      within(await topicRow('What a cache is')).getByRole('button', { name: 'Open lesson' }),
    ).toBeDisabled();
    expect(
      within(await topicRow('Validators')).getByRole('button', { name: 'Open lesson' }),
    ).toBeDisabled();
  });

  it('marks the topic saved as last opened and no other', async () => {
    serve({ progressTopicId: 'topic-2' });
    renderCourse();

    expect(within(await topicRow('Freshness')).getByText('Last opened')).toBeInTheDocument();
    expect(within(await topicRow('What a cache is')).queryByText('Last opened')).toBeNull();
  });

  it('Continue opens the saved topic', async () => {
    serve({ progressTopicId: 'topic-2' });
    renderCourse();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(window.location.hash).toBe('#/learn/lesson-1'));
    expect(callsTo('/topics/topic-2/lesson')).toHaveLength(1);
  });

  it('a failed open shows the server message in an alert and saves no progress', async () => {
    serve({ open: () => Promise.resolve(json(502, { error: 'The AI tool did not answer.' })) });
    renderCourse();
    const user = userEvent.setup();
    await user.click(
      within(await topicRow('Freshness')).getByRole('button', { name: 'Open lesson' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI tool did not answer.');
    expect(window.location.hash).toBe('');
    expect(callsTo('/progress')).toHaveLength(0);
    expect(
      within(await topicRow('Freshness')).getByRole('button', { name: 'Open lesson' }),
    ).toBeEnabled();
  });

  it('shows that a missing course could not be found', async () => {
    serve({ load: () => Promise.resolve(json(404, { error: 'That course does not exist.' })) });
    renderCourse();

    expect(await screen.findByRole('alert')).toHaveTextContent('This course could not be found.');
  });

  it('shows the server message when the course cannot be loaded', async () => {
    serve({
      load: () => Promise.resolve(json(500, { error: 'The course file could not be read.' })),
    });
    renderCourse();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The course file could not be read.',
    );
  });
});
