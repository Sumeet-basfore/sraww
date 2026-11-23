import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiApi } from '../../src/client/lib/api.ts';
import { PROVIDERS, json } from './ai-fixtures.ts';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('aiApi timeouts', () => {
  it('gives the providers request and both saves a timeout signal', async () => {
    fetchMock.mockResolvedValue(json(PROVIDERS));
    await aiApi.providers();
    await aiApi.setDefault('claude');
    await aiApi.saveSelection('claude', { model: 'opus', effort: 'low' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('aiApi.providers', () => {
  it('rejects an empty reply instead of returning a ready state with no data', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(aiApi.providers()).rejects.toThrow('unexpected response');
  });

  it('rejects a reply without a providers list', async () => {
    fetchMock.mockResolvedValue(json({ defaultProvider: 'claude' }));
    await expect(aiApi.providers()).rejects.toThrow('unexpected response');
  });
});
