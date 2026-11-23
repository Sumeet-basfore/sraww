import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSettingsStore, defaultSettings } from '../../src/server/ai/settings-store.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-settings-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const defaults = defaultSettings('claude', { claude: 'sonnet', codex: undefined });

describe('AI settings store', () => {
  it('starts from the defaults when no file exists yet', () => {
    const store = createSettingsStore(path.join(dir, 'ai.json'), defaults);
    expect(store.snapshot()).toEqual(defaults);
    expect(store.snapshot().selections.claude).toEqual({ model: 'sonnet', effort: null });
  });

  it('saves the chosen tool, model and effort and reads them back', async () => {
    const file = path.join(dir, 'ai.json');
    const store = createSettingsStore(file, defaults);
    await store.setDefault('codex');
    await store.setSelection('codex', { model: 'gpt-test-1', effort: 'high' });

    const reloaded = createSettingsStore(file, defaults);
    expect(reloaded.snapshot().defaultProvider).toBe('codex');
    expect(reloaded.snapshot().selections.codex).toEqual({ model: 'gpt-test-1', effort: 'high' });
    expect(reloaded.snapshot().selections.claude.model).toBe('sonnet');
  });

  it('keeps both changes when they are made at the same moment', async () => {
    const file = path.join(dir, 'ai.json');
    const store = createSettingsStore(file, defaults);
    await Promise.all([
      store.setDefault('codex'),
      store.setSelection('codex', { model: 'gpt-test-1', effort: null }),
    ]);

    const onDisk = JSON.parse(await readFile(file, 'utf8')) as {
      defaultProvider: string;
      selections: { codex: { model: string } };
    };
    expect(onDisk.defaultProvider).toBe('codex');
    expect(onDisk.selections.codex.model).toBe('gpt-test-1');
  });

  it('falls back to the defaults when the file is not valid', async () => {
    const file = path.join(dir, 'ai.json');
    await writeFile(file, '{"defaultProvider":"nope"}', 'utf8');
    expect(createSettingsStore(file, defaults).snapshot()).toEqual(defaults);

    await writeFile(file, 'not json', 'utf8');
    expect(createSettingsStore(file, defaults).snapshot()).toEqual(defaults);
  });
});
