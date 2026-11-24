import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, diagramApi } from '../../src/client/lib/api.ts';
import { learnApi } from '../../src/client/lib/learn-api.ts';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('diagramApi', () => {
  it('lists diagrams from the server', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { diagrams: [{ name: 'a' }] }));
    await expect(diagramApi.list()).resolves.toEqual([{ name: 'a' }]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/diagrams');
  });

  it('encodes diagram names in the URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    await diagramApi.remove('a/b c');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/diagrams/a%2Fb%20c');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('turns a server error into an ApiError with the server message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'Diagram "a" already exists.' }));
    const err = await diagramApi.create('a').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: 'Diagram "a" already exists.' });
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(diagramApi.list()).rejects.toMatchObject({ status: 502 });
  });
});

describe('learnApi', () => {
  it('posts the topic and returns the lesson with its skipped-source count', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { lesson: { id: 'l1' }, skippedSources: 2 }));
    await expect(learnApi.create('HTTP caching')).resolves.toEqual({
      lesson: { id: 'l1' },
      skippedSources: 2,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/lessons');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"topic":"HTTP caching"}',
    });
  });

  it('reads a lesson by its id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { lesson: { id: 'l1' } }));
    await expect(learnApi.get('l1')).resolves.toEqual({ lesson: { id: 'l1' } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/lessons/l1');
  });

  it('reports a missing lesson as a 404 with the server message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'That lesson does not exist.' }));
    await expect(learnApi.get('missing')).rejects.toMatchObject({
      status: 404,
      message: 'That lesson does not exist.',
    });
  });
});

describe('learnApi courses', () => {
  it('lists saved courses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { courses: [{ id: 'c1' }] }));
    await expect(learnApi.courses()).resolves.toEqual({ courses: [{ id: 'c1' }] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/courses');
  });

  it('posts the topic to build a course', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { course: { id: 'c1' } }));
    await expect(learnApi.createCourse('HTTP caching')).resolves.toEqual({ course: { id: 'c1' } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/courses');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"topic":"HTTP caching"}',
    });
  });

  it('reads one course with its built lessons, encoding the id', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { course: { id: 'c/1' }, builtLessons: { t1: 'l1' } }),
    );
    await expect(learnApi.course('c/1')).resolves.toEqual({
      course: { id: 'c/1' },
      builtLessons: { t1: 'l1' },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/courses/c%2F1');
  });

  it('opens a topic with a POST that encodes both ids', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { lesson: { id: 'l1' }, skippedSources: 0 }));
    await expect(learnApi.openTopic('c 1', 't/2')).resolves.toMatchObject({
      lesson: { id: 'l1' },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/courses/c%201/topics/t%2F2/lesson');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('saves the progress with a PUT, with the topic id or null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { course: { id: 'c1' } }));
    await expect(learnApi.setProgress('c1', 't1')).resolves.toEqual({ course: { id: 'c1' } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/learn/courses/c1/progress');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      body: '{"topicId":"t1"}',
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { course: { id: 'c1' } }));
    await learnApi.setProgress('c1', null);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: '{"topicId":null}' });
  });

  it('reports a missing course as a 404 with the server message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'That course does not exist.' }));
    await expect(learnApi.course('missing')).rejects.toMatchObject({
      status: 404,
      message: 'That course does not exist.',
    });
  });
});
