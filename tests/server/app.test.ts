import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';

describe('loadConfig', () => {
  it('applies defaults and treats empty model overrides as unset', () => {
    const config = loadConfig({ CLAUDE_MODEL: '', CODEX_MODEL: '' });
    expect(config.PORT).toBe(4317);
    expect(config.AI_PROVIDER).toBe('claude');
    expect(config.CLAUDE_MODEL).toBeUndefined();
    expect(config.CODEX_MODEL).toBeUndefined();
  });

  it('rejects an unknown AI provider with a readable message', () => {
    expect(() => loadConfig({ AI_PROVIDER: 'openai' })).toThrow(/AI_PROVIDER/);
  });
});

describe('createApp', () => {
  const app = createApp(loadConfig({}));

  it('answers the health check', async () => {
    const res = await request(app).get('/api/health').set('Host', '127.0.0.1:4317');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, provider: 'claude' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope').set('Host', '127.0.0.1:4317');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
