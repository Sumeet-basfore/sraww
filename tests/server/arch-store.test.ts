import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createArchStore } from '../../src/server/storage/arch-store.ts';
import { DiagramError } from '../../src/server/storage/diagram-store.ts';
import type { ArchModel } from '../../src/shared/arch-model.ts';
import type { ReviewSidecar } from '../../src/server/arch/review.ts';

let dir: string;
const MODEL: ArchModel = {
  version: 1,
  sourceLabel: 'demo',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'src/a',
      label: 'src/a',
      kind: 'component',
      group: 'src',
      files: 1,
      members: ['src/a/x.ts'],
    },
  ],
  edges: [],
  groups: [{ id: 'src', label: 'src', members: ['src/a'] }],
};

const REVIEW: ReviewSidecar = {
  version: 1,
  generatedAt: '2026-01-02T00:00:00.000Z',
  modelGeneratedAt: MODEL.generatedAt,
  provider: 'claude',
  review: {
    summary: 'Separate responsibilities by feature.',
    findings: [
      {
        severity: 'medium',
        title: 'Split the server boundary',
        evidence: ['src/a'],
        suggestion: 'Split `src/a` by feature.',
      },
    ],
  },
};

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-arch-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('arch store', () => {
  it('returns null when a model has not been saved', async () => {
    expect(await createArchStore(dir).readModel('missing')).toBeNull();
  });

  it('round-trips a model', async () => {
    const store = createArchStore(dir);
    await store.writeModel('demo', MODEL);
    expect(await store.readModel('demo')).toEqual(MODEL);
  });

  it('rejects a model that does not match the schema', async () => {
    const error = await createArchStore(dir)
      .writeModel('demo', { version: 2 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DiagramError);
    expect(error).toMatchObject({ code: 'INVALID_CONTENT' });
  });

  it('stores positions and returns them; removing them returns null', async () => {
    const store = createArchStore(dir);
    await store.writeLayout('demo', { version: 1, positions: { 'src/a': { x: 10, y: 20 } } });
    expect(await store.readLayout('demo')).toEqual({
      version: 1,
      positions: { 'src/a': { x: 10, y: 20 } },
    });
    await store.removeLayout('demo');
    expect(await store.readLayout('demo')).toBeNull();
  });

  it('returns null when a review has not been saved', async () => {
    expect(await createArchStore(dir).readReview('missing')).toBeNull();
  });

  it('round-trips a review sidecar', async () => {
    const store = createArchStore(dir);
    await store.writeReview('demo', REVIEW);
    expect(await store.readReview('demo')).toEqual(REVIEW);
  });

  it('treats corrupt review JSON as invalid content', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, 'demo.arch-review.json'), '{', 'utf8');
    const error = await createArchStore(dir)
      .readReview('demo')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DiagramError);
    expect(error).toMatchObject({ code: 'INVALID_CONTENT' });
  });

  it('reuses name validation for review operations', async () => {
    const store = createArchStore(dir);
    const error = await store.readReview('../escape').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INVALID_NAME' });
    const writeError = await store.writeReview('../escape', REVIEW).catch((e: unknown) => e);
    expect(writeError).toMatchObject({ code: 'INVALID_NAME' });
  });

  it('treats a damaged layout file as no layout rather than failing', async () => {
    const store = createArchStore(dir);
    await store.writeLayout('demo', { version: 1, positions: {} });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, 'demo.arch-layout.json'), '{"version": 9}', 'utf8');
    expect(await store.readLayout('demo')).toBeNull();
  });

  it('rejects names that try to leave the folder', async () => {
    const error = await createArchStore(dir)
      .readModel('../escape')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INVALID_NAME' });
  });
});
