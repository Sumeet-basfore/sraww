// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonReply } from '../../src/shared/learn.ts';
import { layoutGraph, type Layout } from '../../src/client/ai/layout.ts';
import { LessonCanvas } from '../../src/client/learn/LessonCanvas.tsx';
import { canvasProps } from '../mocks/excalidraw.tsx';

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

  it('does not fit the drawing when the page is left before the fit timer fires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(layoutGraph).mockResolvedValue(LAYOUT);
    const scrollToContent = vi.fn();
    const { unmount } = render(<LessonCanvas diagram={DIAGRAM} />);
    await act(async () => undefined);
    await act(async () => {
      canvasProps.current?.excalidrawAPI?.({ scrollToContent });
    });

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(scrollToContent).not.toHaveBeenCalled();
  });
});
