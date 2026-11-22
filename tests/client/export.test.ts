// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportFileName, exportScene } from '../../src/client/editor/export.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

const SNAPSHOT = {
  elements: [
    { id: 'a', type: 'rectangle', isDeleted: false },
    { id: 'b', type: 'rectangle', isDeleted: true },
  ],
  appState: { viewBackgroundColor: '#fff' },
  files: {},
};

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('exportFileName', () => {
  it('builds a file name with the right extension', () => {
    expect(exportFileName('Auth / billing', 'png')).toBe('Auth - billing.png');
    expect(exportFileName('plan', 'excalidraw')).toBe('plan.excalidraw');
  });

  it('falls back to a generic name when nothing is left', () => {
    expect(exportFileName('///', 'svg')).toBe('-.svg');
  });
});

describe('exportScene', () => {
  it('downloads the native .excalidraw JSON with the diagram name', async () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });

    await exportScene('excalidraw', SNAPSHOT, 'plan');

    expect(clicks).toEqual(['plan.excalidraw']);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
