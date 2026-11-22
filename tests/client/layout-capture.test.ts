import { describe, expect, it } from 'vitest';
import { capturePositions } from '../../src/client/arch/layout-capture.ts';

describe('capturePositions', () => {
  it('reads node positions by model id and ignores frames, arrows and deleted nodes', () => {
    const positions = capturePositions([
      { id: 'node:src/server', x: 10, y: 20 },
      { id: 'node:ext:express', x: 300, y: 40 },
      { id: 'group:src', x: 0, y: 0 },
      { id: 'edge:src/server>ext:express', x: 0, y: 0 },
      { id: 'node:old', x: 1, y: 1, isDeleted: true },
    ]);
    expect(positions).toEqual({
      'src/server': { x: 10, y: 20 },
      'ext:express': { x: 300, y: 40 },
    });
  });
});
