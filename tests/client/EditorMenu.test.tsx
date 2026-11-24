// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useEffect, useRef, useState } from 'react';
import { EditorMenu, EditorMenuItem } from '../../src/client/editor/EditorMenu.tsx';
import { MoreMenuItems } from '../../src/client/editor/EditorMenuItems.tsx';

function MenuPair() {
  const [openMenu, setOpenMenu] = useState<'first' | 'second' | null>(null);
  return (
    <>
      <EditorMenu
        id="first"
        label="First"
        open={openMenu === 'first'}
        onToggle={() => setOpenMenu(openMenu === 'first' ? null : 'first')}
        onClose={() => setOpenMenu(null)}
      >
        <EditorMenuItem onClick={() => undefined}>First action</EditorMenuItem>
      </EditorMenu>
      <EditorMenu
        id="second"
        label="Second"
        open={openMenu === 'second'}
        onToggle={() => setOpenMenu(openMenu === 'second' ? null : 'second')}
        onClose={() => setOpenMenu(null)}
      >
        <EditorMenuItem onClick={() => undefined}>Second action</EditorMenuItem>
      </EditorMenu>
    </>
  );
}

/** Stands in for the architecture inspector: a dialog that takes focus when it mounts. */
function FocusingDialog() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} role="dialog" aria-label="Architecture inspector" tabIndex={-1}>
      Inspector
    </div>
  );
}

function MoreMenuWithArchitecture() {
  const [open, setOpen] = useState(false);
  const [inspector, setInspector] = useState(false);
  return (
    <>
      <EditorMenu
        id="more"
        label="More"
        open={open}
        onToggle={() => setOpen((value) => !value)}
        onClose={() => setOpen(false)}
      >
        <MoreMenuItems
          disabled={false}
          architecture
          onArchitecture={() => setInspector(true)}
          onTemplate={() => undefined}
          onFormula={() => undefined}
          onFileAction={() => undefined}
          onTheme={() => undefined}
          themeAction="Dark theme"
          themeIcon="*"
          drawingStyle="hand"
          onDrawingStyle={() => undefined}
        />
      </EditorMenu>
      {inspector && <FocusingDialog />}
    </>
  );
}

afterEach(() => cleanup());

describe('EditorMenu', () => {
  it('keeps focus in the newly opened menu when switching menu triggers', async () => {
    const user = userEvent.setup();
    render(<MenuPair />);

    await user.click(screen.getByRole('button', { name: 'First' }));
    await screen.findByRole('menuitem', { name: 'First action' });
    await user.click(screen.getByRole('button', { name: 'Second' }));

    const secondAction = await screen.findByRole('menuitem', { name: 'Second action' });
    await expect.poll(() => document.activeElement).toBe(secondAction);
  });

  it('keeps focus in a text field that is clicked while a menu is open', async () => {
    const user = userEvent.setup();
    render(
      <>
        <MenuPair />
        <textarea aria-label="Assistant" />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'First' }));
    await screen.findByRole('menuitem', { name: 'First action' });
    await user.click(screen.getByRole('textbox', { name: 'Assistant' }));

    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole('textbox', { name: 'Assistant' }));
  });

  it('moves focus into the inspector that the Architecture action opens', async () => {
    const user = userEvent.setup();
    render(<MoreMenuWithArchitecture />);

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Architecture' }));

    const dialog = await screen.findByRole('dialog', { name: 'Architecture inspector' });
    await expect.poll(() => document.activeElement).toBe(dialog);
  });
});
