import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDiagramStore, DiagramError } from '../../src/server/storage/diagram-store.ts';
import { emptyScene } from '../../src/shared/diagram.ts';

let dir: string;
let store: ReturnType<typeof createDiagramStore>;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-test-'));
  store = createDiagramStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function expectDiagramError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
  await expect(promise).rejects.toBeInstanceOf(DiagramError);
}

describe('diagram store: names', () => {
  it.each(['../secret', 'a/b', '/etc/passwd', '..', '.hidden', 'a\\b', ''])(
    'rejects unsafe name %j',
    async (name) => {
      await expectDiagramError(store.read(name), 'INVALID_NAME');
    },
  );

  it('accepts ordinary names with spaces, dashes and underscores', async () => {
    await store.create('My System_v2-draft', emptyScene());
    const list = await store.list();
    expect(list.map((d) => d.name)).toEqual(['My System_v2-draft']);
  });
});

describe('diagram store: lifecycle', () => {
  it('creates, reads and lists diagrams', async () => {
    await store.create('overview', emptyScene());
    const scene = await store.read('overview');
    expect(scene.type).toBe('excalidraw');
    expect((await store.list()).map((d) => d.name)).toEqual(['overview']);
  });

  it('refuses to create over an existing diagram', async () => {
    await store.create('overview', emptyScene());
    await expectDiagramError(store.create('overview', emptyScene()), 'EXISTS');
  });

  it('reports NOT_FOUND for a missing diagram', async () => {
    await expectDiagramError(store.read('missing'), 'NOT_FOUND');
  });

  it('saves changes by replacing the file', async () => {
    await store.create('overview', emptyScene());
    const updated = { ...emptyScene(), elements: [{ id: 'a', type: 'rectangle' }] };
    await store.write('overview', updated);
    const scene = await store.read('overview');
    expect(scene.elements).toHaveLength(1);
  });

  it('renames a diagram and refuses to overwrite another', async () => {
    await store.create('one', emptyScene());
    await store.create('two', emptyScene());
    await expectDiagramError(store.rename('one', 'two'), 'EXISTS');
    await store.rename('one', 'three');
    expect((await store.list()).map((d) => d.name)).toEqual(['three', 'two']);
  });

  it('duplicates a diagram under a new name', async () => {
    await store.create('base', { ...emptyScene(), elements: [{ id: 'x', type: 'ellipse' }] });
    await store.duplicate('base', 'base copy');
    const copy = await store.read('base copy');
    expect(copy.elements).toEqual([{ id: 'x', type: 'ellipse' }]);
  });

  it('deletes a diagram', async () => {
    await store.create('gone', emptyScene());
    await store.remove('gone');
    await expectDiagramError(store.read('gone'), 'NOT_FOUND');
  });

  it('lists nothing for a folder that does not exist yet', async () => {
    const fresh = createDiagramStore(path.join(dir, 'not-yet'));
    expect(await fresh.list()).toEqual([]);
  });
});

describe('diagram store: safety', () => {
  it('rejects invalid scene content before touching disk', async () => {
    await expectDiagramError(
      store.create('bad', { type: 'something-else' } as never),
      'INVALID_CONTENT',
    );
    expect(await readdir(dir)).toEqual([]);
  });

  it('writes atomically and leaves no temp files behind', async () => {
    await store.create('clean', emptyScene());
    await store.write('clean', emptyScene());
    const entries = await readdir(dir);
    expect(entries).toEqual(['clean.excalidraw']);
  });

  it('ignores unrelated files in the folder when listing', async () => {
    await writeFile(path.join(dir, 'notes.txt'), 'hello');
    await store.create('real', emptyScene());
    expect((await store.list()).map((d) => d.name)).toEqual(['real']);
    expect(await readFile(path.join(dir, 'notes.txt'), 'utf8')).toBe('hello');
  });
});
