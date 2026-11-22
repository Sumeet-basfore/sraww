import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, type SaveStatus } from '../../src/client/editor/autosave.ts';

type Value = { id: string; version: number };
const fingerprint = (v: Value) => `${v.id}:${v.version}`;

let statuses: SaveStatus[];
let save: ReturnType<typeof vi.fn<(v: Value) => Promise<void>>>;

beforeEach(() => {
  vi.useFakeTimers();
  statuses = [];
  save = vi.fn(async () => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

function make() {
  return createAutosave<Value>({
    save,
    fingerprint,
    delayMs: 800,
    onStatusChange: (s) => statuses.push(s),
  });
}

describe('autosave', () => {
  it('does not save right after loading (reset sets the baseline)', async () => {
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    expect(auto.hasUnsavedChanges()).toBe(false);
  });

  it('debounces rapid changes into one save of the latest value', async () => {
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 2 });
    await vi.advanceTimersByTimeAsync(300);
    auto.update({ id: 'a', version: 3 });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ id: 'a', version: 3 });
  });

  it('reports unsaved, saving and saved in order', async () => {
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 2 });
    await vi.advanceTimersByTimeAsync(900);
    expect(statuses).toEqual(['unsaved', 'saving', 'saved']);
  });

  it('flush saves immediately and reports success', async () => {
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 2 });
    await expect(auto.flush()).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps the change and reports error when a save fails, then retries on flush', async () => {
    save.mockRejectedValueOnce(new Error('server down'));
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 2 });
    await expect(auto.flush()).resolves.toBe(false);
    expect(statuses.at(-1)).toBe('error');
    expect(auto.hasUnsavedChanges()).toBe(true);

    await expect(auto.flush()).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('saves a change made while a save is running, after the first save finishes', async () => {
    let finishFirst: () => void = () => undefined;
    save.mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 2 });
    const first = auto.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    auto.update({ id: 'a', version: 3 });
    finishFirst();
    await first;
    await vi.advanceTimersByTimeAsync(900);
    expect(save.mock.calls.map((c) => c[0].version)).toEqual([2, 3]);
  });

  it('a change back to the saved state cancels the pending save', async () => {
    const auto = make();
    auto.reset({ id: 'a', version: 1 });
    auto.update({ id: 'a', version: 2 });
    auto.update({ id: 'a', version: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });
});
