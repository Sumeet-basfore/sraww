// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonReply } from '../../src/shared/learn.ts';
import { layoutGraph, type Layout } from '../../src/client/ai/layout.ts';
import { LessonCanvas } from '../../src/client/learn/LessonCanvas.tsx';
import { canvasProps, type FakeCanvasApi } from '../mocks/excalidraw.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));
vi.mock('../../src/client/ai/layout.ts', () => ({ layoutGraph: vi.fn() }));

const DIAGRAM: LessonReply['diagram'] = {
  direction: 'right',
  nodes: [
    { id: 'client', label: 'Client', shape: 'rounded' },
    { id: 'cache', label: 'Cache', shape: 'rounded' },
  ],
  edges: [{ from: 'client', to: 'cache', label: 'request' }],
};

const LAYOUT: Layout = {
  boxes: new Map([
    ['client', { x: 0, y: 0, width: 160, height: 60 }],
    ['cache', { x: 240, y: 0, width: 160, height: 60 }],
  ]),
  frames: new Map(),
};

function fakeCanvasApi(overrides: Partial<FakeCanvasApi> = {}): FakeCanvasApi {
  return {
    getAppState: () =>
      ({ zoom: { value: 1 }, width: 800, height: 600, scrollX: 0, scrollY: 0 }) as ReturnType<
        FakeCanvasApi['getAppState']
      >,
    getSceneElements: () => [],
    onScrollChange: () => () => undefined,
    scrollToContent: vi.fn<FakeCanvasApi['scrollToContent']>(),
    updateScene: vi.fn<FakeCanvasApi['updateScene']>(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(layoutGraph).mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LessonCanvas', () => {
  it('says the drawing could not be made when the layout fails', async () => {
    vi.mocked(layoutGraph).mockRejectedValue(new Error('layout engine crashed'));
    render(<LessonCanvas diagram={DIAGRAM} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The drawing could not be made.');
    expect(screen.queryByTestId('excalidraw-canvas')).not.toBeInTheDocument();
  });

  it('draws the lesson on a read-only canvas once the layout succeeds', async () => {
    vi.mocked(layoutGraph).mockResolvedValue(LAYOUT);
    render(<LessonCanvas diagram={DIAGRAM} />);
    await waitFor(() => expect(screen.getByTestId('excalidraw-canvas')).toBeInTheDocument());
    expect(canvasProps.current?.viewModeEnabled).toBe(true);
  });

  it("turns AI off and keeps the editor's canvas options", async () => {
    vi.mocked(layoutGraph).mockResolvedValue(LAYOUT);
    render(<LessonCanvas diagram={DIAGRAM} />);
    await waitFor(() => expect(screen.getByTestId('excalidraw-canvas')).toBeInTheDocument());
    expect(canvasProps.current?.aiEnabled).toBe(false);
    expect(canvasProps.current?.UIOptions).toEqual({ canvasActions: { loadScene: false } });
  });

  it("offers sraww's own links in its menu, as the editor does", async () => {
    vi.mocked(layoutGraph).mockResolvedValue(LAYOUT);
    render(<LessonCanvas diagram={DIAGRAM} />);
    const menu = within(await screen.findByTestId('main-menu'));
    expect(menu.getByRole('button', { name: 'sraww on GitHub' })).toBeInTheDocument();
    expect(menu.getByRole('button', { name: 'Report an issue' })).toBeInTheDocument();
  });

  it('does not fit the drawing when the page is left before the fit timer fires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(layoutGraph).mockResolvedValue(LAYOUT);
    const scrollToContent = vi.fn();
    const { unmount } = render(<LessonCanvas diagram={DIAGRAM} />);
    await act(async () => undefined);
    await act(async () => {
      canvasProps.current?.excalidrawAPI?.(fakeCanvasApi({ scrollToContent }));
    });

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(scrollToContent).not.toHaveBeenCalled();
  });

  it('draws one more step on Next, and Skip to end draws the whole lesson', async () => {
    vi.mocked(layoutGraph).mockResolvedValue(LAYOUT);
    render(<LessonCanvas diagram={DIAGRAM} />);
    await waitFor(() => expect(screen.getByTestId('excalidraw-canvas')).toBeInTheDocument());
    const updateScene = vi.fn<FakeCanvasApi['updateScene']>();
    act(() =>
      canvasProps.current?.excalidrawAPI?.(
        fakeCanvasApi({ scrollToContent: vi.fn(), updateScene }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(updateScene).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }));
    expect(updateScene).toHaveBeenCalledTimes(2);
    const [partial = 0, whole = 0] = updateScene.mock.calls.map(
      ([scene]) => scene.elements?.length ?? 0,
    );

    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(whole);
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
  });
});
