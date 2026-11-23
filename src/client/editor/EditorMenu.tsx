import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface EditorMenuProps {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  icon?: string;
  disabled?: boolean;
}

export function EditorMenu({
  id,
  label,
  open,
  onToggle,
  onClose,
  children,
  className = '',
  icon,
  disabled = false,
}: EditorMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent): void {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        onClose();
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onClose]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [
      ...(wrapperRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"], [role="menuitemradio"]',
      ) ?? []),
    ].filter((item) => !item.disabled);
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : current <= 0
              ? items.length - 1
              : current - 1;
    items[next]?.focus();
  }

  function closeAfterAction(focusManaged = false): void {
    onClose();
    if (focusManaged) return;
    window.setTimeout(() => {
      const active = document.activeElement;
      if (
        active === document.body ||
        wrapperRef.current?.querySelector('[role="menu"]')?.contains(active)
      ) {
        triggerRef.current?.focus();
      }
    }, 0);
  }

  return (
    <div className={`editor-dropdown ${className}`} ref={wrapperRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="editor-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={icon ? label : undefined}
        disabled={disabled}
        onClick={onToggle}
      >
        {icon ? <span aria-hidden="true">{icon}</span> : label}
      </button>
      {open && (
        <div id={`${id}-menu`} className="editor-menu-popup" role="menu" aria-label={label}>
          <div
            onClick={(event) => {
              const item = (event.target as HTMLElement).closest(
                '[role="menuitem"], [role="menuitemradio"]',
              );
              if (item) closeAfterAction(item.hasAttribute('data-focus-managed'));
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function EditorMenuItem({
  children,
  onClick,
  disabled = false,
  className = '',
  focusManaged = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  focusManaged?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`editor-menu-item ${className}`}
      disabled={disabled}
      data-focus-managed={focusManaged || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
