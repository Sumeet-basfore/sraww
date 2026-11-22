import { describe, expect, it } from 'vitest';
import { architectureHash, editorHash, parseRoute } from '../../src/client/lib/route.ts';

describe('parseRoute', () => {
  it('shows the list for an empty hash', () => {
    expect(parseRoute('')).toEqual({ view: 'list' });
    expect(parseRoute('#/')).toEqual({ view: 'list' });
  });

  it('opens the editor for a diagram hash', () => {
    expect(parseRoute('#/diagram/My%20system')).toEqual({ view: 'editor', name: 'My system' });
  });

  it('opens the architecture view for an architecture hash', () => {
    expect(parseRoute('#/arch/Core%20map')).toEqual({ view: 'architecture', name: 'Core map' });
  });

  it('falls back to the list for a malformed encoding', () => {
    expect(parseRoute('#/diagram/%E0%A4%A')).toEqual({ view: 'list' });
    expect(parseRoute('#/arch/%E0%A4%A')).toEqual({ view: 'list' });
  });

  it('round-trips with the hash builders', () => {
    const name = 'Auth & billing v2';
    expect(parseRoute(editorHash(name))).toEqual({ view: 'editor', name });
    expect(parseRoute(architectureHash(name))).toEqual({ view: 'architecture', name });
  });
});
