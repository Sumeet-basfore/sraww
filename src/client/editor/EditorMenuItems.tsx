import type { DrawingStyle } from '../lib/prefs.ts';
import type { TemplateKind } from '../math/insert-template.ts';
import { EditorMenuItem } from './EditorMenu.tsx';

export function InsertMenuItems({
  disabled,
  onTemplate,
  onFormula,
}: {
  disabled: boolean;
  onTemplate: (kind: TemplateKind) => void;
  onFormula: () => void;
}) {
  return (
    <>
      <EditorMenuItem disabled={disabled} onClick={() => onTemplate('axes')}>
        Axes
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onTemplate('number-line')}>
        Number line
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onTemplate('table')}>
        Table
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={onFormula}>
        Formula (LaTeX)…
      </EditorMenuItem>
    </>
  );
}

export function FileMenuItems({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (action: string) => void;
}) {
  return (
    <>
      <EditorMenuItem disabled={disabled} onClick={() => onSelect('png')}>
        Export PNG image
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onSelect('svg')}>
        Export SVG image
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onSelect('excalidraw')}>
        Export .excalidraw file
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onSelect('import-drawing')}>
        Import .excalidraw file as new drawing…
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onSelect('import-library')}>
        Import library (.excalidrawlib)…
      </EditorMenuItem>
      <EditorMenuItem disabled={disabled} onClick={() => onSelect('export-library')}>
        Export library (.excalidrawlib)
      </EditorMenuItem>
    </>
  );
}

export function MoreMenuItems({
  disabled,
  architecture,
  onArchitecture,
  onTemplate,
  onFormula,
  onFileAction,
  onTour,
  onTheme,
  themeAction,
  themeIcon,
  drawingStyle,
  onDrawingStyle,
}: {
  disabled: boolean;
  architecture: boolean;
  onArchitecture: () => void;
  onTemplate: (kind: TemplateKind) => void;
  onFormula: () => void;
  onFileAction: (action: string) => void;
  onTour?: () => void;
  onTheme: () => void;
  themeAction: string;
  themeIcon: string;
  drawingStyle: DrawingStyle;
  onDrawingStyle: (style: DrawingStyle) => void;
}) {
  return (
    <>
      <div className="editor-menu-group" role="group" aria-label="Insert">
        <span className="editor-menu-heading">Insert</span>
        <InsertMenuItems disabled={disabled} onTemplate={onTemplate} onFormula={onFormula} />
      </div>
      <div className="editor-menu-group" role="group" aria-label="File">
        <span className="editor-menu-heading">File</span>
        <FileMenuItems disabled={disabled} onSelect={onFileAction} />
      </div>
      {architecture && (
        <EditorMenuItem disabled={disabled} onClick={onArchitecture}>
          Architecture
        </EditorMenuItem>
      )}
      {onTour && <EditorMenuItem onClick={onTour}>Tour</EditorMenuItem>}
      <EditorMenuItem onClick={onTheme} className="theme-menu-item">
        {themeIcon} {themeAction}
      </EditorMenuItem>
      <div className="editor-menu-group" role="group" aria-label="Drawing style">
        <span className="editor-menu-heading">Drawing style</span>
        {(['hand', 'clean'] as const).map((style) => (
          <EditorMenuItem key={style} onClick={() => onDrawingStyle(style)}>
            {drawingStyle === style ? '✓ ' : ''}
            {style === 'hand' ? 'Hand-drawn' : 'Clean'}
          </EditorMenuItem>
        ))}
      </div>
    </>
  );
}
