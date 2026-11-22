import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hostnameOf, localOnlyGuard } from '../../src/server/guard.ts';

function makeApp() {
  const app = express();
  app.use(localOnlyGuard);
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('hostnameOf', () => {
  it('extracts the hostname from host and origin values', () => {
    expect(hostnameOf('127.0.0.1:4317')).toBe('127.0.0.1');
    expect(hostnameOf('http://localhost:5173')).toBe('localhost');
    expect(hostnameOf('not a host name with spaces')).toBeNull();
  });
});

describe('localOnlyGuard', () => {
  it('allows requests addressed to loopback', async () => {
    const res = await request(makeApp()).get('/ping').set('Host', '127.0.0.1:4317');
    expect(res.status).toBe(200);
  });

  it('rejects a DNS-rebinding style Host header', async () => {
    const res = await request(makeApp()).get('/ping').set('Host', 'evil.example.com:4317');
    expect(res.status).toBe(403);
  });

  it('rejects a cross-origin browser request', async () => {
    const res = await request(makeApp())
      .get('/ping')
      .set('Host', '127.0.0.1:4317')
      .set('Origin', 'https://attacker.example');
    expect(res.status).toBe(403);
  });

  it('allows a loopback Origin', async () => {
    const res = await request(makeApp())
      .get('/ping')
      .set('Host', '127.0.0.1:4317')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
  });
});
