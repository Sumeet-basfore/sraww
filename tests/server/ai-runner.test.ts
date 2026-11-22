import { describe, expect, it } from 'vitest';
import { AiError } from '../../src/server/ai/ai-error.ts';
import { runCommand } from '../../src/server/ai/runner.ts';

const base = { cwd: process.cwd(), maxOutputBytes: 1024 * 1024 };

describe('runCommand', () => {
  it('sends the input on stdin and returns stdout', async () => {
    const result = await runCommand({
      ...base,
      command: 'node',
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
      input: 'hello there',
      timeoutMs: 10_000,
    });
    expect(result.stdout).toBe('hello there');
    expect(result.exitCode).toBe(0);
  });

  it('passes only PATH and HOME to the child process', async () => {
    const result = await runCommand({
      ...base,
      command: 'node',
      args: ['-e', 'console.log(Object.keys(process.env).sort().join(","))'],
      input: '',
      timeoutMs: 10_000,
    });
    const keys = result.stdout.trim().split(',');
    for (const key of keys) {
      expect(['PATH', 'HOME']).toContain(key);
    }
    expect(keys).toContain('PATH');
  });

  it('kills a child that runs past the timeout', async () => {
    const error = await runCommand({
      ...base,
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      input: '',
      timeoutMs: 300,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: 'TIMEOUT' });
  });

  it('stops a child that writes more output than allowed', async () => {
    const error = await runCommand({
      ...base,
      maxOutputBytes: 1000,
      command: 'node',
      args: ['-e', 'process.stdout.write("x".repeat(100000))'],
      input: '',
      timeoutMs: 10_000,
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'OUTPUT_TOO_LARGE' });
  });

  it('reports a missing binary as NOT_INSTALLED', async () => {
    const error = await runCommand({
      ...base,
      command: 'definitely-not-a-real-binary-sraww',
      args: [],
      input: '',
      timeoutMs: 10_000,
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'NOT_INSTALLED' });
  });
});
