// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ImportError,
  MAX_IMPORT_BYTES,
  nameFromFileName,
  readDrawingFile,
  uniqueName,
} from '../../src/client/diagrams/import.ts';

const VALID_SCENE = {
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'a', type: 'rectangle' }],
  appState: {},
  files: {},
};

function fileOf(text: string, name: string): File {
  return new File([text], name, { type: 'application/json' });
}

describe('nameFromFileName', () => {
  it('drops the extension and keeps readable characters', () => {
    expect(nameFromFileName('Billing flow.excalidraw')).toBe('Billing flow');
  });

  it('removes path-like and symbol characters', () => {
    expect(nameFromFileName('../../etc/passwd.json')).toBe('etc passwd');
  });

  it('always returns a name the server accepts', () => {
    expect(nameFromFileName('!!!.excalidraw')).toMatch(/^[a-zA-Z0-9]/);
    expect(nameFromFileName('x'.repeat(200) + '.excalidraw').length).toBeLessThanOrEqual(81);
  });
});

describe('uniqueName', () => {
  it('keeps a free name as it is', () => {
    expect(uniqueName('notes', ['other'])).toBe('notes');
  });

  it('adds the next free number when the name is taken', () => {
    expect(uniqueName('notes', ['notes'])).toBe('notes (2)');
    expect(uniqueName('notes', ['notes', 'notes (2)'])).toBe('notes (3)');
  });
});

describe('readDrawingFile', () => {
  it('accepts a valid Excalidraw file and derives its name', async () => {
    const drawing = await readDrawingFile(fileOf(JSON.stringify(VALID_SCENE), 'Sketch.excalidraw'));
    expect(drawing.name).toBe('Sketch');
    expect(drawing.scene.elements).toHaveLength(1);
  });

  it('rejects text that is not JSON', async () => {
    await expect(readDrawingFile(fileOf('hello', 'x.excalidraw'))).rejects.toThrow(ImportError);
  });

  it('rejects JSON that is not an Excalidraw drawing', async () => {
    const notDrawing = JSON.stringify({ type: 'something-else', elements: 'nope' });
    await expect(readDrawingFile(fileOf(notDrawing, 'x.json'))).rejects.toThrow(
      /not an Excalidraw drawing/,
    );
  });

  it('rejects files over the size limit before reading them', async () => {
    const big = fileOf('{}', 'big.excalidraw');
    Object.defineProperty(big, 'size', { value: MAX_IMPORT_BYTES + 1 });
    await expect(readDrawingFile(big)).rejects.toThrow(/larger than 10 MB/);
  });
});
