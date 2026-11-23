import { describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_ZIP_BYTES } from '../../src/shared/project-rules.ts';
import {
  fetchRepoZip,
  parseGithubTarget,
  stripArchiveRoot,
} from '../../src/server/projects/github.ts';

function responseWithBody(
  chunks: Uint8Array[],
  options: { status?: number; headers?: HeadersInit; url?: string } = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const response = new Response(stream, {
    status: options.status ?? 200,
    headers: options.headers,
  });
  if (options.url) Object.defineProperty(response, 'url', { value: options.url });
  return response;
}

describe('GitHub target parsing', () => {
  it('builds branch and HEAD archive URLs', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => responseWithBody([new Uint8Array([1])]));
    await fetchRepoZip(parseGithubTarget({ repo: 'owner/project', ref: 'main' }), fetchImpl);
    await fetchRepoZip(parseGithubTarget({ repo: 'owner/project', ref: 'feature/x' }), fetchImpl);
    await fetchRepoZip(parseGithubTarget({ repo: 'owner/project' }), fetchImpl);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://codeload.github.com/owner/project/zip/refs/heads/main',
      'https://codeload.github.com/owner/project/zip/refs/heads/feature/x',
      'https://codeload.github.com/owner/project/zip/HEAD',
    ]);
  });

  it('allows dotted branch refs but rejects URL and path injection', () => {
    expect(parseGithubTarget({ repo: 'owner/project', ref: 'v1.0' }).ref).toBe('v1.0');
    for (const ref of ['../x', 'a?b', 'a b']) {
      expect(() => parseGithubTarget({ repo: 'owner/project', ref })).toThrow();
    }
    for (const repo of ['a/..', './..', 'a/b/c']) {
      expect(() => parseGithubTarget({ repo })).toThrow();
    }
  });
});

describe('fetchRepoZip', () => {
  it('returns downloaded bytes', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(responseWithBody([new Uint8Array([1, 2, 3])]));
    await expect(fetchRepoZip({ repo: 'owner/project' }, fetchImpl)).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it('maps a missing repository or branch to a readable 404', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(responseWithBody([], { status: 404 }));
    await expect(fetchRepoZip({ repo: 'owner/project' }, fetchImpl)).rejects.toMatchObject({
      message: 'Repository or branch not found.',
      status: 404,
    });
  });

  it('rejects an oversized Content-Length before reading the body', async () => {
    let bodyRead = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          bodyRead = true;
        },
      },
      { highWaterMark: 0 },
    );
    const response = {
      body,
      headers: new Headers({ 'Content-Length': String(MAX_UPLOAD_ZIP_BYTES + 1) }),
      ok: true,
      status: 200,
      url: '',
    } as Response;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(fetchRepoZip({ repo: 'owner/project' }, fetchImpl)).rejects.toMatchObject({
      status: 413,
    });
    expect(bodyRead).toBe(false);
  });

  it('rejects an oversized streamed body without Content-Length', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(responseWithBody([new Uint8Array(MAX_UPLOAD_ZIP_BYTES + 1)]));
    await expect(fetchRepoZip({ repo: 'owner/project' }, fetchImpl)).rejects.toMatchObject({
      status: 413,
    });
  });

  it('rejects a redirect whose final host is not codeload.github.com', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        responseWithBody([new Uint8Array([1])], { url: 'https://example.com/archive.zip' }),
      );
    await expect(fetchRepoZip({ repo: 'owner/project' }, fetchImpl)).rejects.toMatchObject({
      message: 'The download did not come from GitHub.',
      status: 502,
    });
  });
});

describe('stripArchiveRoot', () => {
  it('removes the shared archive wrapper and preserves a src-only root', () => {
    expect(stripArchiveRoot(['repo-main/src/a.ts'])('repo-main/src/a.ts')).toBe('src/a.ts');
    expect(stripArchiveRoot(['repo-main/README.md'])('repo-main/README.md')).toBe('README.md');
    const strip = stripArchiveRoot(['repo-main/src/a.ts', 'repo-main/src/b.ts']);
    expect(strip('repo-main/src/a.ts')).toBe('src/a.ts');
    expect(strip('repo-main/src/b.ts')).toBe('src/b.ts');
  });
});
