// Which files of an uploaded project are kept. The browser uses the same rules to skip large
// folders before zipping; the server applies them again, so a modified browser cannot bypass them.

export const MAX_UPLOAD_FILES = 5_000;
/** Total size of the files kept, after unpacking. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_BYTES = 1024 * 1024;
/** Size of the zip file that is sent. */
export const MAX_UPLOAD_ZIP_BYTES = 60 * 1024 * 1024;

const MAX_PATH_CHARS = 300;
const MAX_PATH_SEGMENTS = 24;

/** Folders that hold installed packages, build output or caches. Never useful to map. */
const EXCLUDED_FOLDERS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'out',
  'vendor',
  '.next',
  '.nuxt',
  '.cache',
  '__pycache__',
  'target',
]);

/** Files that hold credentials, keys, or lock data. These are never kept. */
const EXCLUDED_FILES: readonly RegExp[] = [
  /^\.env(\..*)?$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^\.netrc$/i,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^credentials(\.json)?$/i,
  /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$/,
];

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'pdf',
  'zip',
  'gz',
  'tgz',
  'tar',
  '7z',
  'rar',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'class',
  'jar',
  'mp3',
  'mp4',
  'mov',
  'wav',
  'ogg',
  'webm',
  'wasm',
]);

export type PathVerdict = { ok: true } | { ok: false; reason: string };

/** Decides, from the path alone, whether a file of an upload is kept. */
export function checkPath(rawPath: string): PathVerdict {
  const path = rawPath.replace(/\\/g, '/');
  if (!path || path.startsWith('/') || path.includes('\0') || /^[A-Za-z]:/.test(path)) {
    return { ok: false, reason: 'an unsafe path' };
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return { ok: false, reason: 'an unsafe path' };
  }
  if (path.length > MAX_PATH_CHARS || segments.length > MAX_PATH_SEGMENTS) {
    return { ok: false, reason: 'a path that is too long' };
  }
  if (segments.slice(0, -1).some((segment) => EXCLUDED_FOLDERS.has(segment))) {
    return { ok: false, reason: 'a package, build or cache folder' };
  }
  const name = segments[segments.length - 1] ?? '';
  if (EXCLUDED_FILES.some((pattern) => pattern.test(name))) {
    return { ok: false, reason: 'a credential, key or lock file' };
  }
  const extension = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '';
  if (BINARY_EXTENSIONS.has(extension)) {
    return { ok: false, reason: 'a binary file' };
  }
  return { ok: true };
}

/** A folder name the browser can skip without reading its files. */
export function isExcludedFolder(name: string): boolean {
  return EXCLUDED_FOLDERS.has(name);
}

/**
 * True when a path lies inside a package, build, cache or version-control folder. The browser skips
 * these before reading them, because they are the bulk of a project's size. Everything else is sent
 * to the server, which lists each file it leaves out and the reason.
 */
export function isInsideExcludedFolder(rawPath: string): boolean {
  const segments = rawPath.replace(/\\/g, '/').split('/');
  return segments.slice(0, -1).some((segment) => EXCLUDED_FOLDERS.has(segment));
}
