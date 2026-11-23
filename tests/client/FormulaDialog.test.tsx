// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormulaDialog } from '../../src/client/math/FormulaDialog.tsx';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

afterEach(cleanup);

function makeApi() {
  return {
    getAppState: () => ({ width: 800, height: 600, scrollX: 0, scrollY: 0, zoom: { value: 1 } }),
    getSceneElementsIncludingDeleted: () => [],
    addFiles: vi.fn(),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
  } as unknown as ExcalidrawImperativeAPI;
}

describe('FormulaDialog', () => {
  it('posts once on submit and closes after inserting the formula', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const api = makeApi();
    const mathApi = { render: vi.fn().mockResolvedValue({ svg: '<svg/>', width: 48, height: 32 }) };
    render(<FormulaDialog api={api} mathApi={mathApi} onClose={onClose} />);

    await user.type(screen.getByRole('textbox', { name: /latex/i }), 'x^2');
    await user.click(screen.getByRole('button', { name: /insert formula/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mathApi.render).toHaveBeenCalledTimes(1);
    expect(mathApi.render).toHaveBeenCalledWith({ latex: 'x^2', fontSize: 20 });
  });

  it('shows a server error and stays open after a 400', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const api = makeApi();
    const mathApi = {
      render: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('Invalid LaTeX.'), { status: 400 })),
    };
    render(<FormulaDialog api={api} mathApi={mathApi} onClose={onClose} />);

    await user.type(screen.getByRole('textbox', { name: /latex/i }), 'x^');
    await user.click(screen.getByRole('button', { name: /insert formula/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid LaTeX.');
    expect(onClose).not.toHaveBeenCalled();
    expect(mathApi.render).toHaveBeenCalledTimes(1);
  });

  it('strips leading and trailing dollar signs before posting', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    const mathApi = { render: vi.fn().mockResolvedValue({ svg: '<svg/>', width: 48, height: 32 }) };
    render(<FormulaDialog api={api} mathApi={mathApi} onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: /latex/i }), '$x^2$');
    await user.click(screen.getByRole('button', { name: /insert formula/i }));

    await waitFor(() => expect(mathApi.render).toHaveBeenCalledTimes(1));
    expect(mathApi.render).toHaveBeenCalledWith({ latex: 'x^2', fontSize: 20 });
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FormulaDialog api={makeApi()} mathApi={{ render: vi.fn() }} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
