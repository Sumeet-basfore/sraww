import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import { projectsApi, type ProjectSummary } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { readZipFile, zipFolder } from './zip-folder.ts';

interface ProjectsSectionProps {
  /** Called after an upload or a delete, so the architecture form can list the change. */
  onChanged: () => void;
}

// Browsers accept a whole folder only through this attribute, which React does not type.
const FOLDER_ATTRIBUTES = {
  webkitdirectory: '',
} as unknown as InputHTMLAttributes<HTMLInputElement>;

function projectNameFrom(files: readonly File[], isFolder: boolean): string {
  const first = files[0];
  if (!first) return 'Project';
  if (isFolder) return (first.webkitRelativePath.split('/')[0] || 'Project').slice(0, 80);
  return first.name.replace(/\.zip$/i, '').slice(0, 80) || 'Project';
}

function Excluded({ items }: { items: ProjectSummary['excluded'] }) {
  if (items.length === 0) return <p className="muted small">Nothing was left out.</p>;
  return (
    <details className="excluded">
      <summary>
        {items.length} file{items.length === 1 ? '' : 's'} left out
      </summary>
      <ul className="plain-list small">
        {items.map((item) => (
          <li key={item.path}>
            <code>{item.path}</code> — {item.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Code projects: upload a project folder or zip so its structure can be mapped. The privacy notice
 * must be accepted first. Every file that is left out is listed with the reason.
 */
export function ProjectsSection({ onChanged }: ProjectsSectionProps) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ProjectSummary | null>(null);
  const [githubRepo, setGithubRepo] = useState('');
  const [githubRef, setGithubRef] = useState('');
  const [githubName, setGithubName] = useState('');
  const [githubConsent, setGithubConsent] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setProjects((await projectsApi.list()).projects);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: File[], isFolder: boolean): Promise<void> {
    if (files.length === 0) return;
    setError(null);
    setLast(null);
    setStatus('Packing the project…');
    try {
      const zip = isFolder ? await zipFolder(files) : await readZipFile(files[0] as File);
      setStatus('Uploading and checking the files…');
      const created = await projectsApi.upload(zip, projectNameFrom(files, isFolder));
      setLast(created);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStatus(null);
    }
  }

  async function remove(project: ProjectSummary): Promise<void> {
    const question = `Delete “${project.name}” and every file uploaded with it? Architecture maps made from it are kept; delete them from the drawing list.`;
    if (!window.confirm(question)) return;
    setError(null);
    try {
      await projectsApi.remove(project.id);
      if (last?.id === project.id) setLast(null);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function importGithub(): Promise<void> {
    setError(null);
    setLast(null);
    setStatus('Downloading and checking the GitHub repository…');
    try {
      const created = await projectsApi.importGithub({
        repo: githubRepo.trim(),
        ...(githubRef.trim() ? { ref: githubRef.trim() } : {}),
        name: githubName.trim(),
        consent: true,
      });
      setLast(created);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStatus(null);
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>, isFolder: boolean): void {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void upload(files, isFolder);
  }

  const busy = status !== null;

  return (
    <section className="projects" aria-labelledby="projects-title">
      <h2 id="projects-title">Code projects</h2>
      <aside className="privacy-notice" aria-labelledby="privacy-notice-title">
        <h3 id="privacy-notice-title">Your code stays on this computer</h3>
        <p>
          An AI tool sees only folder paths and file names, and only when you press Review with AI
          or Name with AI.
        </p>
        <p>File contents are never sent.</p>
        <a href="/PRIVACY.md">Details</a>
      </aside>

      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I understand that this project’s code is kept on this computer, and that an AI tool sees
          only folder paths and file names, and only when I press Review with AI or Name with AI.
        </span>
      </label>

      <div className="form-actions">
        <button
          type="button"
          className="button primary"
          disabled={!consent || busy}
          onClick={() => folderInput.current?.click()}
        >
          Upload a project folder
        </button>
        <button
          type="button"
          className="button"
          disabled={!consent || busy}
          onClick={() => zipInput.current?.click()}
        >
          Upload a zip file
        </button>
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          aria-label="Choose a project folder"
          {...FOLDER_ATTRIBUTES}
          onChange={(e) => onPick(e, true)}
        />
        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          aria-label="Choose a project zip file"
          onChange={(e) => onPick(e, false)}
        />
      </div>

      <details className="github-import">
        <summary>From GitHub</summary>
        <div className="github-import-fields">
          <label>
            <span>GitHub repository (owner/repo)</span>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Branch (optional)</span>
            <input
              type="text"
              value={githubRef}
              onChange={(e) => setGithubRef(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Project name</span>
            <input
              type="text"
              value={githubName}
              onChange={(e) => setGithubName(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={githubConsent}
              onChange={(e) => setGithubConsent(e.target.checked)}
            />
            <span>
              This downloads the public repository from GitHub (codeload.github.com). The code then
              stays on this computer, and nothing is sent to an AI tool.
            </span>
          </label>
          <button
            type="button"
            className="button primary"
            disabled={!githubConsent || !githubRepo.trim() || !githubName.trim() || busy}
            onClick={() => void importGithub()}
          >
            Import from GitHub
          </button>
        </div>
      </details>

      {status && (
        <p role="status" className="muted">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}

      {last && (
        <div className="preview">
          <p>
            {last.source?.kind === 'github' ? 'Imported' : 'Uploaded'} “{last.name}”
            {last.source?.kind === 'github' ? ` from ${last.source.repo} (GitHub)` : ''}:{' '}
            {last.fileCount} file
            {last.fileCount === 1 ? '' : 's'} kept. Map it below under “Map a project”.
          </p>
          <Excluded items={last.excluded} />
        </div>
      )}

      {projects && projects.length > 0 && (
        <ul className="rows project-rows">
          {projects.map((project) => (
            <li key={project.id} className="row">
              <div>
                <span className="row-title-static">{project.name}</span>
                <span className="row-meta">
                  {' '}
                  {project.fileCount} files ·{' '}
                  {project.source?.kind === 'github' ? 'imported' : 'uploaded'}{' '}
                  {new Date(project.createdAt).toLocaleString()}
                  {project.source?.kind === 'github' ? ` · ${project.source.repo} (GitHub)` : ''}
                </span>
                <Excluded items={project.excluded} />
              </div>
              <span className="row-actions">
                <button
                  type="button"
                  className="button ghost small danger"
                  onClick={() => void remove(project)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
