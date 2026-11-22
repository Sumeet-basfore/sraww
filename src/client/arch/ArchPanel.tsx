import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useMemo, useState } from 'react';
import type { ArchDiff, ArchModel, ArchNode } from '../../shared/arch-model.ts';
import { archApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { capturePositions } from './layout-capture.ts';
import { elementIds } from './render.ts';
import { architectureElements } from './to-scene.ts';

const LIST_LIMIT = 12;

interface ArchPanelProps {
  name: string;
  getApi: () => ExcalidrawImperativeAPI | null;
  onClose: () => void;
}

function describeDiff(diff: ArchDiff): string {
  if (!diff.hasBaseline) return 'First scan. Nothing to compare with yet.';
  const parts = [
    `${diff.addedNodes.length} new / ${diff.removedNodes.length} removed folders`,
    `${diff.addedEdges.length} new / ${diff.removedEdges.length} removed links`,
  ];
  return parts.join(' · ');
}

function Names({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="small muted panel-sub">{title}</p>
      <ul className="plain-list small">
        {items.slice(0, LIST_LIMIT).map((item) => (
          <li key={item}>
            <code>{item}</code>
          </li>
        ))}
        {items.length > LIST_LIMIT && (
          <li className="muted">and {items.length - LIST_LIMIT} more</li>
        )}
      </ul>
    </>
  );
}

function NodeDetails({ model, node }: { model: ArchModel; node: ArchNode }) {
  const outgoing = model.edges.filter((e) => e.from === node.id).sort((a, b) => b.count - a.count);
  const incoming = model.edges.filter((e) => e.to === node.id).sort((a, b) => b.count - a.count);
  const label = (id: string): string => model.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <section className="node-details" aria-label="Selected folder">
      <h3>{node.label}</h3>
      <p className="small muted">
        {node.kind === 'external' ? 'Package' : `${node.files} file${node.files === 1 ? '' : 's'}`}
      </p>
      {outgoing.length > 0 && (
        <>
          <p className="small muted panel-sub">Depends on</p>
          <ul className="plain-list small">
            {outgoing.slice(0, LIST_LIMIT).map((e) => (
              <li key={e.to}>
                {label(e.to)} <span className="muted">×{e.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {incoming.length > 0 && (
        <>
          <p className="small muted panel-sub">Used by</p>
          <ul className="plain-list small">
            {incoming.slice(0, LIST_LIMIT).map((e) => (
              <li key={e.from}>
                {label(e.from)} <span className="muted">×{e.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {node.members.length > 0 && (
        <>
          <p className="small muted panel-sub">Files</p>
          <ul className="plain-list small">
            {node.members.slice(0, LIST_LIMIT).map((file) => (
              <li key={file}>
                <code>{file}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function ArchPanel({ name, getApi, onClose }: ArchPanelProps) {
  const [model, setModel] = useState<ArchModel | null>(null);
  const [diff, setDiff] = useState<ArchDiff | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    archApi
      .model(name)
      .then(({ model: loaded }) => {
        if (!cancelled) setModel(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  useEffect(() => {
    const api = getApi();
    if (!api) return undefined;
    const ids = (selection: Record<string, unknown> | undefined): string[] =>
      Object.keys(selection ?? {});
    setSelectedIds(ids(api.getAppState().selectedElementIds));
    return api.onChange((_elements, appState) => {
      const next = ids(appState.selectedElementIds);
      setSelectedIds((prev) => (prev.join('|') === next.join('|') ? prev : next));
    });
  }, [getApi]);

  // Frame the whole map once when it opens. The canvas needs a moment to measure itself first;
  // re-framing on every render would undo the user's pan and zoom.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const api = getApi();
      if (api) api.scrollToContent(api.getSceneElements(), { fitToContent: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedNode = useMemo(() => {
    if (!model) return null;
    const first = selectedIds.find((id) => id.startsWith(elementIds.node('')));
    if (!first) return null;
    const nodeId = first.slice(elementIds.node('').length);
    return model.nodes.find((n) => n.id === nodeId) ?? null;
  }, [model, selectedIds]);

  async function redraw(
    nextModel: ArchModel,
    layout: Awaited<ReturnType<typeof archApi.model>>['layout'],
  ) {
    const api = getApi();
    if (!api) return;
    const elements = await architectureElements(nextModel, layout);
    api.updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    api.scrollToContent(elements, { fitToContent: true });
  }

  async function run(action: () => Promise<void>, done: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function rescan(): Promise<void> {
    return run(async () => {
      const api = getApi();
      if (!api || !model) throw new Error('The drawing is not ready yet.');
      if (!model.projectId) {
        throw new Error(
          'This map has no project to scan. Map the project again from the start page.',
        );
      }
      await archApi.saveLayout(name, capturePositions(api.getSceneElementsIncludingDeleted()));
      const result = await archApi.scan(model.projectId, name);
      await redraw(result.model, result.layout);
      setModel(result.model);
      setDiff(result.diff);
    }, 'Re-scanned. Your box positions were kept.');
  }

  function saveLayout(): Promise<void> {
    return run(async () => {
      const api = getApi();
      if (!api) throw new Error('The drawing is not ready yet.');
      await archApi.saveLayout(name, capturePositions(api.getSceneElementsIncludingDeleted()));
    }, 'Layout saved. It will be kept on the next scan.');
  }

  function resetLayout(): Promise<void> {
    return run(async () => {
      if (!model) throw new Error('The map is not loaded yet.');
      await archApi.resetLayout(name);
      await redraw(model, null);
    }, 'Layout reset to the automatic arrangement.');
  }

  async function copyFiles(node: ArchNode): Promise<void> {
    try {
      await navigator.clipboard.writeText(node.members.join('\n'));
      setNotice(`Copied ${node.members.length} file path(s).`);
    } catch {
      setError('Copying is not available in this browser.');
    }
  }

  const components = model?.nodes.filter((n) => n.kind === 'component').length ?? 0;
  const packages = model?.nodes.filter((n) => n.kind === 'external').length ?? 0;

  return (
    <aside className="ai-panel arch-panel" role="dialog" aria-labelledby="arch-title">
      <header className="ai-panel-header">
        <h2 id="arch-title">Architecture</h2>
        <button type="button" className="button ghost small" onClick={onClose} aria-label="Close">
          Close
        </button>
      </header>

      {model && (
        <>
          <p className="small muted">
            From {model.sourceLabel}, scanned {new Date(model.generatedAt).toLocaleString()}
          </p>
          <dl className="arch-stats">
            <div>
              <dt>Folders</dt>
              <dd>{components}</dd>
            </div>
            <div>
              <dt>Links</dt>
              <dd>{model.edges.length}</dd>
            </div>
            <div>
              <dt>Packages</dt>
              <dd>{packages}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="arch-actions">
        <button
          type="button"
          className="button primary small"
          disabled={busy || !model}
          onClick={() => void rescan()}
        >
          {busy ? 'Working…' : 'Re-scan'}
        </button>
        <button
          type="button"
          className="button ghost small"
          disabled={busy || !model}
          onClick={() => void saveLayout()}
        >
          Save layout
        </button>
        <button
          type="button"
          className="button ghost small danger"
          disabled={busy || !model}
          onClick={() => void resetLayout()}
        >
          Reset layout
        </button>
      </div>

      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}
      {notice && <p className="banner notice">{notice}</p>}

      {diff && (
        <section aria-label="Changes since last scan">
          <p className="small">{describeDiff(diff)}</p>
          <Names title="New folders" items={diff.addedNodes} />
          <Names title="Removed folders" items={diff.removedNodes} />
          <Names title="New links" items={diff.addedEdges} />
          <Names title="Removed links" items={diff.removedEdges} />
        </section>
      )}

      {selectedNode && model ? (
        <>
          <NodeDetails model={model} node={selectedNode} />
          {selectedNode.members.length > 0 && (
            <button
              type="button"
              className="button ghost small"
              onClick={() => void copyFiles(selectedNode)}
            >
              Copy file list
            </button>
          )}
        </>
      ) : (
        <p className="muted small">Select a box in the map to see its files and links.</p>
      )}

      <p className="muted small">
        Re-scan reads the project again. Use “Save layout” after moving boxes so the next scan keeps
        them.
      </p>
    </aside>
  );
}
