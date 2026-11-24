import { useEffect, useState, type FormEvent } from 'react';
import { diagramApi, archApi, type ArchProjectInfo } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { diagramNameError, diagramNameSchema } from '../../shared/diagram.ts';

interface ArchNewFormProps {
  existingNames: readonly string[];
  onOpen: (name: string) => void;
}

/** Maps one of the allowed project folders into a new architecture diagram. */
export function ArchNewForm({ existingNames, onOpen }: ArchNewFormProps) {
  const [projects, setProjects] = useState<ArchProjectInfo[] | null>(null);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    archApi
      .projects()
      .then(({ projects: list }) => {
        setProjects(list);
        setProjectId(list[0]?.id ?? '');
        setName(list[0] ? `${list[0].label} map` : '');
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function handleMap(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const target = name.trim();
    if (!projectId || !target) return;
    if (!diagramNameSchema.safeParse(target).success) {
      setError(diagramNameError);
      return;
    }
    const exists = existingNames.includes(target);
    if (
      exists &&
      !window.confirm(
        `Replace the drawing "${target}" with a fresh map? Your box positions are kept.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { architectureElements, architectureScene } = await import('./to-scene.ts');
      const { model, layout } = await archApi.scan(projectId, target);
      const scene = architectureScene(await architectureElements(model, layout));
      if (exists) await diagramApi.save(target, scene);
      else await diagramApi.create(target, scene);
      onOpen(target);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="arch-new" aria-labelledby="arch-new-title">
      <h2 id="arch-new-title">Map a project</h2>
      <p className="muted small">
        Draws the folders of a project and how they depend on each other, from its imports.
      </p>
      {projects && projects.length === 0 && (
        <p className="banner">Upload a project above, then map it here.</p>
      )}
      {projects && projects.length > 0 && (
        <form className="arch-new-form" onSubmit={(e) => void handleMap(e)}>
          <label>
            <span className="small muted">Project</span>
            <select
              value={projectId}
              disabled={busy}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="small muted">Diagram name</span>
            <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="button primary" disabled={busy || !name.trim()}>
            {busy ? 'Mapping…' : 'Map project'}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}
    </section>
  );
}
