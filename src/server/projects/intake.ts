import { unzipSync } from 'fflate';
import {
  checkPath,
  MAX_FILE_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
} from '../../shared/project-rules.ts';

export interface UploadedFile {
  path: string;
  data: Uint8Array;
}

export interface Exclusion {
  path: string;
  reason: string;
}

export interface Intake {
  files: UploadedFile[];
  excluded: Exclusion[];
  bytes: number;
}

/** An error the client can read, with an HTTP status. */
export function intakeError(
  message: string,
  status: number,
): Error & { status: number; expose: boolean } {
  return Object.assign(new Error(message), { status, expose: true });
}

/** Patterns for credentials that are often pasted into code. A match excludes the whole file. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{36,}/,
  /sk-[A-Za-z0-9_-]{24,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /AIza[0-9A-Za-z_-]{35}/,
];

/** A file is binary when its first bytes contain a zero byte. */
export function looksBinary(data: Uint8Array): boolean {
  const end = Math.min(data.length, 8_000);
  for (let i = 0; i < end; i += 1) {
    if (data[i] === 0) return true;
  }
  return false;
}

export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Reads a zip of a project. Names are checked before anything is unpacked, so a file that escapes
 * the folder, or is excluded by name, costs nothing. The remaining files are checked for size,
 * binary content and secrets. Anything that fails is listed with its reason, not silently dropped.
 */
export function readZip(bytes: Uint8Array): Intake {
  const excluded: Exclusion[] = [];
  let declaredBytes = 0;
  let kept = 0;

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter(file) {
        if (file.name.endsWith('/')) return false;
        declaredBytes += file.originalSize;
        if (declaredBytes > MAX_UPLOAD_BYTES) {
          throw intakeError(
            'The project is too large once it is unpacked. Choose a smaller folder.',
            413,
          );
        }
        const verdict = checkPath(file.name);
        if (!verdict.ok) {
          excluded.push({ path: file.name, reason: verdict.reason });
          return false;
        }
        if (file.originalSize > MAX_FILE_BYTES) {
          excluded.push({ path: file.name, reason: 'larger than 1 MB' });
          return false;
        }
        kept += 1;
        if (kept > MAX_UPLOAD_FILES) {
          throw intakeError(
            `The project has more than ${MAX_UPLOAD_FILES} files. Choose a smaller folder.`,
            413,
          );
        }
        return true;
      },
    });
  } catch (err) {
    if ((err as { status?: number }).status) throw err;
    throw intakeError('The upload is not a valid zip archive.', 400);
  }

  const files: UploadedFile[] = [];
  let bytesKept = 0;
  for (const [path, data] of Object.entries(entries)) {
    if (looksBinary(data)) {
      excluded.push({ path, reason: 'a binary file' });
      continue;
    }
    const text = new TextDecoder().decode(data);
    if (containsSecret(text)) {
      excluded.push({ path, reason: 'text that looks like a secret or key' });
      continue;
    }
    bytesKept += data.length;
    files.push({ path, data });
  }
  excluded.sort((a, b) => a.path.localeCompare(b.path));
  return { files, excluded, bytes: bytesKept };
}
