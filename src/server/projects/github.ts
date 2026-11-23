import { MAX_UPLOAD_ZIP_BYTES } from '../../shared/project-rules.ts';
import { intakeError } from './intake.ts';

export interface GithubTarget {
  repo: string;
  ref?: string;
}

/** Parse a public GitHub repository and branch. Tags are not supported. */
export function parseGithubTarget(input: GithubTarget): { repo: string; ref: string } {
  const repoPattern = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
  if (!repoPattern.test(input.repo)) throw intakeError('Enter a valid GitHub repository.', 400);
  const [owner, name] = input.repo.split('/');
  if (owner === '.' || owner === '..' || name === '.' || name === '..') {
    throw intakeError('Enter a valid GitHub repository.', 400);
  }

  const ref = input.ref ?? 'HEAD';
  if (ref !== 'HEAD') {
    const segments = ref.split('/');
    if (
      ref.length < 1 ||
      ref.length > 200 ||
      segments.some((segment) => segment === '' || segment === '..') ||
      /[\\?#%\s]/u.test(ref) ||
      [...ref].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
      })
    ) {
      throw intakeError('Enter a valid GitHub branch name.', 400);
    }
  }
  return { repo: input.repo, ref };
}

/** Download a public GitHub branch zip, enforcing the compressed upload size limit. */
export async function fetchRepoZip(
  target: GithubTarget,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 60_000,
): Promise<Uint8Array> {
  const parsed = parseGithubTarget(target);
  const [owner, repo] = parsed.repo.split('/');
  const url =
    parsed.ref === 'HEAD'
      ? `https://codeload.github.com/${owner}/${repo}/zip/HEAD`
      : `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${parsed.ref
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/')}`;
  const signal = AbortSignal.timeout(timeoutMs);
  let currentUrl = url;
  let redirects = 0;
  let response: Response;
  while (true) {
    response = await fetchImpl(currentUrl, { redirect: 'manual', signal });
    if (response.type === 'opaqueredirect') {
      throw intakeError('The download did not come from GitHub.', 502);
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (isRedirect) {
      if (redirects >= 3) {
        throw intakeError('GitHub redirected the download too many times.', 502);
      }
      const location = response.headers.get('Location');
      if (!location) throw intakeError('The download did not come from GitHub.', 502);

      let redirectUrl: URL;
      try {
        redirectUrl = new URL(location, currentUrl);
      } catch {
        throw intakeError('The download did not come from GitHub.', 502);
      }
      if (redirectUrl.protocol !== 'https:' || redirectUrl.host !== 'codeload.github.com') {
        throw intakeError('The download did not come from GitHub.', 502);
      }

      currentUrl = redirectUrl.href;
      redirects += 1;
      continue;
    }
    if (response.status >= 300 && response.status < 400 && !response.headers.get('Location')) {
      throw intakeError('The download did not come from GitHub.', 502);
    }
    break;
  }

  if (response.status === 404) throw intakeError('Repository or branch not found.', 404);
  if (!response.ok) throw intakeError('The GitHub archive could not be downloaded.', 502);

  const contentLength = response.headers.get('Content-Length');
  if (contentLength !== null && Number(contentLength) > MAX_UPLOAD_ZIP_BYTES) {
    throw intakeError('The GitHub archive is too large.', 413);
  }

  if (!response.body) throw intakeError('The GitHub archive could not be downloaded.', 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_UPLOAD_ZIP_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The size limit remains the relevant error if cancellation races with stream closure.
      }
      throw intakeError('The GitHub archive is too large.', 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Remove codeload's single archive wrapper directory from each matching path. */
export function stripArchiveRoot(paths: string[]): (p: string) => string | null {
  const root = paths[0]?.split('/')[0] ?? '';
  const prefix = `${root}/`;
  return (path) => {
    if (!path.startsWith(prefix)) return path;
    const stripped = path.slice(prefix.length);
    return stripped || null;
  };
}
