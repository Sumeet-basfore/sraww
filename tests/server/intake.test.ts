import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readZip } from '../../src/server/projects/intake.ts';
import { MAX_UPLOAD_BYTES } from '../../src/shared/project-rules.ts';

const encoder = new TextEncoder();

describe('readZip size limits', () => {
  it('does not count excluded entries toward the unpacked size limit', () => {
    // Zeros compress to almost nothing, so this zip is small but unpacks past the limit.
    const dependencies = new Uint8Array(MAX_UPLOAD_BYTES + 1024);
    const zip = zipSync({
      'node_modules/pkg/big.js': dependencies,
      'src/index.ts': encoder.encode('export {};'),
    });

    const intake = readZip(zip);

    expect(intake.files.map((file) => file.path)).toEqual(['src/index.ts']);
    expect(intake.excluded).toEqual([
      { path: 'node_modules/pkg/big.js', reason: 'a package, build or cache folder' },
    ]);
  });
});
