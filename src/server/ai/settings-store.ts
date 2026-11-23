import { readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import {
  providerIdSchema,
  selectionSchema,
  PROVIDER_IDS,
  type ProviderId,
  type ProviderSelection,
} from '../../shared/ai-account.ts';

export interface AiSettings {
  defaultProvider: ProviderId;
  selections: Record<ProviderId, ProviderSelection>;
}

const storedSchema = z.object({
  defaultProvider: providerIdSchema,
  selections: z.object({
    claude: selectionSchema,
    codex: selectionSchema,
  }),
});

/** Reads the settings file synchronously at startup. A missing or broken file means defaults. */
function loadSettings(file: string, defaults: AiSettings): AiSettings {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return defaults;
  }
  try {
    const parsed = storedSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}

export interface SettingsStore {
  snapshot(): AiSettings;
  setDefault(provider: ProviderId): Promise<AiSettings>;
  setSelection(provider: ProviderId, selection: ProviderSelection): Promise<AiSettings>;
}

/**
 * Keeps the chosen AI tool, model and effort in one small JSON file under the data folder.
 * It never holds credentials; sign-in stays with the CLIs.
 */
export function createSettingsStore(file: string, defaults: AiSettings): SettingsStore {
  const target = path.resolve(file);
  let current = loadSettings(target, defaults);
  let queue: Promise<unknown> = Promise.resolve();

  /**
   * Applies one change to the latest settings and writes the result. Changes run one after
   * another, so two changes made at the same moment both survive.
   */
  function change(mutate: (previous: AiSettings) => AiSettings): Promise<AiSettings> {
    const run = async (): Promise<AiSettings> => {
      const next = mutate(current);
      await mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        await rename(tmp, target);
      } catch (err) {
        await rm(tmp, { force: true });
        throw err;
      }
      current = next;
      return next;
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  }

  return {
    snapshot: () => current,
    setDefault: (provider) => change((previous) => ({ ...previous, defaultProvider: provider })),
    setSelection: (provider, selection) =>
      change((previous) => ({
        ...previous,
        selections: { ...previous.selections, [provider]: selection },
      })),
  };
}

/** The settings used when no settings file exists yet. Model overrides come from the environment. */
export function defaultSettings(
  defaultProvider: ProviderId,
  models: Record<ProviderId, string | undefined>,
): AiSettings {
  const selections = Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, { model: models[id] ?? null, effort: null }]),
  ) as Record<ProviderId, ProviderSelection>;
  return { defaultProvider, selections };
}
