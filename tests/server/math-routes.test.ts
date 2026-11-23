import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';

const HOST = '127.0.0.1:4317';
const app = createApp(
  loadConfig({}),
  createDiagramStore('/tmp/sraww-math-routes'),
  '/tmp/sraww-no-client',
);

describe('math render route', () => {
  it('returns an SVG and positive numeric dimensions as JSON', async () => {
    const res = await request(app)
      .post('/api/math/render')
      .set('Host', HOST)
      .send({ latex: 'x^2' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(typeof res.body.svg).toBe('string');
    expect(res.body.svg).toContain('<svg');
    expect(typeof res.body.width).toBe('number');
    expect(typeof res.body.height).toBe('number');
    expect(res.body.width).toBeGreaterThan(0);
    expect(res.body.height).toBeGreaterThan(0);
  });

  it('uses the requested font size when rendering', async () => {
    const defaultResponse = await request(app)
      .post('/api/math/render')
      .set('Host', HOST)
      .send({ latex: 'x^2' });
    const largerResponse = await request(app)
      .post('/api/math/render')
      .set('Host', HOST)
      .send({ latex: 'x^2', fontSize: 28 });

    expect(defaultResponse.status).toBe(200);
    expect(largerResponse.status).toBe(200);
    expect(largerResponse.body.width).toBeGreaterThan(defaultResponse.body.width);
  });

  it.each([
    ['empty latex', { latex: '' }],
    ['latex over 500 characters', { latex: 'x'.repeat(501) }],
    ['invalid TeX', { latex: '\\frac{' }],
    ['font size below the range', { latex: 'x', fontSize: 5 }],
    ['font size above the range', { latex: 'x', fontSize: 200 }],
  ])('returns a JSON validation error for %s', async (_caseName, body) => {
    const res = await request(app).post('/api/math/render').set('Host', HOST).send(body);

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
