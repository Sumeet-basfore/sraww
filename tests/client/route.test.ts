import { describe, expect, it } from 'vitest';
import {
  architectureHash,
  editorHash,
  learnHash,
  lessonHash,
  mapsHash,
  parseRoute,
} from '../../src/client/lib/route.ts';

describe('parseRoute', () => {
  it('shows the list for an empty hash', () => {
    expect(parseRoute('')).toEqual({ view: 'list' });
    expect(parseRoute('#/')).toEqual({ view: 'list' });
  });

  it('opens the top-level pages for their tab hashes', () => {
    expect(parseRoute('#/learn')).toEqual({ view: 'learn' });
    expect(parseRoute('#/architecture')).toEqual({ view: 'maps' });
    expect(parseRoute('#/ai')).toEqual({ view: 'ai' });
    expect(parseRoute(learnHash())).toEqual({ view: 'learn' });
    expect(parseRoute(mapsHash())).toEqual({ view: 'maps' });
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

  it('opens a lesson for a learn hash with a valid id', () => {
    expect(parseRoute('#/learn/Lesson_2026-01')).toEqual({ view: 'lesson', id: 'Lesson_2026-01' });
  });

  it('accepts an id of the longest allowed length', () => {
    const id = 'a'.repeat(64);
    expect(parseRoute(`#/learn/${id}`)).toEqual({ view: 'lesson', id });
  });

  it('falls back to the Learn tab for an empty or invalid lesson id', () => {
    expect(parseRoute('#/learn/')).toEqual({ view: 'learn' });
    expect(parseRoute('#/learn/bad.id')).toEqual({ view: 'learn' });
    expect(parseRoute('#/learn/a/b')).toEqual({ view: 'learn' });
    expect(parseRoute(`#/learn/${'a'.repeat(65)}`)).toEqual({ view: 'learn' });
  });

  it('round-trips a lesson id with the hash builder', () => {
    expect(parseRoute(lessonHash('lesson-1'))).toEqual({ view: 'lesson', id: 'lesson-1' });
    expect(lessonHash('lesson-1')).toBe('#/learn/lesson-1');
  });
});
