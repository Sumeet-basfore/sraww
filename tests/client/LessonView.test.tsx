// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonView } from '../../src/client/learn/LessonView.tsx';

vi.mock('../../src/client/learn/LessonCanvas.tsx', () => ({ LessonCanvas: () => null }));

const fetchMock = vi.fn();

const lesson = {
  id: 'lesson-1',
  topic: 'How HTTP caching works',
  title: 'HTTP caching: keep a copy, check it is fresh',
  explanation:
    'A cache keeps a copy of a response.\n\nCache-Control says how long the copy stays fresh.',
  keyTerms: ['Cache-Control', 'max-age'],
  sources: [
    {
      title: 'HTTP caching guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
      points: ['Freshness is set by max-age.'],
    },
  ],
  diagram: {
    direction: 'right',
    nodes: [{ id: 'browser', label: 'Browser', shape: 'rounded' }],
    edges: [],
  },
  createdAt: '2026-11-24T10:00:00.000Z',
  provider: 'claude',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Deferred {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
}

function deferred(): Deferred {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderLesson(): void {
  render(<LessonView id="lesson-1" onShowTour={() => undefined} />);
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

describe('LessonView', () => {
  it('requests the lesson by its id', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { lesson }));
    renderLesson();
    await screen.findByRole('heading', { level: 1, name: lesson.title });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/lessons/lesson-1');
  });

  it('shows the title, the explanation as paragraphs, and the key terms', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { lesson }));
    renderLesson();
    expect(
      await screen.findByRole('heading', { level: 1, name: lesson.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('A cache keeps a copy of a response.')).toBeInTheDocument();
    expect(
      screen.getByText('Cache-Control says how long the copy stays fresh.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Cache-Control', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('max-age', { selector: 'li' })).toBeInTheDocument();
  });

  it('links each source to its address in a new tab, with its host name and points', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { lesson }));
    renderLesson();
    const link = await screen.findByRole('link', { name: 'HTTP caching guide' });
    expect(link).toHaveAttribute(
      'href',
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('developer.mozilla.org')).toBeInTheDocument();
    expect(screen.getByText('Freshness is set by max-age.')).toBeInTheDocument();
    expect(screen.getByText('Read the sources to check this explanation.')).toBeInTheDocument();
  });

  it.each([
    ['mozilla.org/x', 'Relative source'],
    ['javascript:alert(1)', 'Script source'],
  ])(
    'shows a source with the address %s as plain text, with no link and no crash',
    async (url, title) => {
      const withBadSource = {
        ...lesson,
        sources: [{ title, url, points: ['Freshness is set by max-age.'] }],
      };
      fetchMock.mockResolvedValueOnce(reply(200, { lesson: withBadSource }));
      renderLesson();
      expect(
        await screen.findByRole('heading', { level: 1, name: lesson.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: title })).not.toBeInTheDocument();
      expect(screen.getByText('Freshness is set by max-age.')).toBeInTheDocument();
    },
  );

  it('describes the diagram in words, hidden on screen, for people who cannot see the drawing', async () => {
    const withDiagram = {
      ...lesson,
      diagram: {
        direction: 'right',
        nodes: [
          { id: 'client', label: 'Client', shape: 'rounded' },
          { id: 'cache', label: 'Cache', shape: 'rounded' },
          { id: 'server', label: 'Server', shape: 'rounded' },
        ],
        edges: [
          { from: 'client', to: 'cache', label: 'request' },
          { from: 'cache', to: 'server', label: 'miss' },
        ],
      },
    };
    fetchMock.mockResolvedValueOnce(reply(200, { lesson: withDiagram }));
    renderLesson();
    await screen.findByRole('heading', { level: 1, name: lesson.title });
    expect(
      screen.getByText(
        'Boxes: Client, Cache, Server. Arrows: Client to Cache, labelled request. Cache to Server, labelled miss.',
      ),
    ).toHaveClass('visually-hidden');
  });

  it('keeps lesson B on screen when lesson A answers after the switch to B', async () => {
    const lessonA = { ...lesson, id: 'lesson-a', title: 'First lesson: keep a copy' };
    const lessonB = { ...lesson, id: 'lesson-b', title: 'Second lesson: check freshness' };
    const answerA = deferred();
    const answerB = deferred();
    fetchMock.mockReturnValueOnce(answerA.promise).mockReturnValueOnce(answerB.promise);

    const { rerender } = render(<LessonView id="lesson-a" onShowTour={() => undefined} />);
    rerender(<LessonView id="lesson-b" onShowTour={() => undefined} />);
    await act(async () => {
      answerB.resolve(reply(200, { lesson: lessonB }));
    });
    await screen.findByRole('heading', { level: 1, name: lessonB.title });

    await act(async () => {
      answerA.resolve(reply(200, { lesson: lessonA }));
      await new Promise((done) => setTimeout(done, 50));
    });
    expect(screen.getByRole('heading', { level: 1, name: lessonB.title })).toBeInTheDocument();
    expect(screen.queryByText(lessonA.title)).not.toBeInTheDocument();
  });

  it('keeps a Learn link back to the Learn tab', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { lesson }));
    renderLesson();
    expect(await screen.findByRole('link', { name: '← Learn' })).toHaveAttribute('href', '#/learn');
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
  });

  it('says the lesson could not be found when the server answers 404', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { error: 'That lesson does not exist.' }));
    renderLesson();
    expect(await screen.findByRole('alert')).toHaveTextContent('This lesson could not be found.');
  });

  it('shows the server message when the lesson request fails', async () => {
    fetchMock.mockResolvedValueOnce(reply(500, { error: 'The lesson file could not be read.' }));
    renderLesson();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The lesson file could not be read.',
    );
  });
});
