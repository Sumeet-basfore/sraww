import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';

const HOST = '127.0.0.1:4317';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-headers-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('security headers', () => {
  it('sends a content security policy and framing and sniffing protection on API responses', async () => {
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const res = await request(app).get('/api/health').set('Host', HOST);
    expect(res.headers['content-security-policy']).toBe(CONTENT_SECURITY_POLICY);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('forbids scripts from anywhere but this origin', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});
