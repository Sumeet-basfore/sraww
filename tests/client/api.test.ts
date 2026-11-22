import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, diagramApi } from '../../src/client/lib/api.ts';

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
