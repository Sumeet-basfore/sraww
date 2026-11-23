import type { ExcalidrawScene } from '../../shared/diagram.ts';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import type { ChatOp, ChatRequest } from '../../shared/chat-schemas.ts';
import type { ArchDiff, ArchLayout, ArchModel } from '../../shared/arch-model.ts';
import type { ArchFinding } from '../../shared/arch-findings.ts';
import type {
  LoginFlow,
  ProviderId,
  ProviderSelection,
  ProviderView,
  ProvidersView,
} from '../../shared/ai-account.ts';

export interface ChatResponse {
  provider: ProviderId;
  reply: string;
  ops: ChatOp[];
  rejected: string[];
}

export interface DiagramSummary {
  name: string;
  updatedAt: string;
  sizeBytes: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

const diagramPath = (name: string): string => `/diagrams/${encodeURIComponent(name)}`;

export const diagramApi = {
  async list(): Promise<DiagramSummary[]> {
    const body = await request<{ diagrams: DiagramSummary[] }>('/diagrams');
    return body.diagrams;
  },
  read(name: string): Promise<ExcalidrawScene> {
    return request<ExcalidrawScene>(diagramPath(name));
  },
  create(name: string, scene?: ExcalidrawScene): Promise<{ name: string }> {
    return request('/diagrams', { method: 'POST', body: JSON.stringify({ name, scene }) });
  },
  save(name: string, scene: ExcalidrawScene): Promise<void> {
    return request(diagramPath(name), { method: 'PUT', body: JSON.stringify(scene) });
  },
  rename(name: string, newName: string): Promise<{ name: string }> {
    return request(diagramPath(name), { method: 'PATCH', body: JSON.stringify({ name: newName }) });
  },
  duplicate(name: string, copyName: string): Promise<{ name: string }> {
    return request(`${diagramPath(name)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: copyName }),
    });
  },
  remove(name: string): Promise<void> {
    return request(diagramPath(name), { method: 'DELETE' });
  },
};

export interface ProjectExclusion {
  path: string;
  reason: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  consentAt: string;
  fileCount: number;
  bytes: number;
  excluded: ProjectExclusion[];
  source?: { kind: 'github'; repo: string; ref: string };
}

export const projectsApi = {
  list(): Promise<{ projects: ProjectSummary[] }> {
    return request('/projects');
  },
  /** Sends a zip of a project. The privacy notice must have been accepted, which the query records. */
  async upload(zipBytes: Uint8Array, name: string): Promise<ProjectSummary> {
    const query = new URLSearchParams({ name, consent: 'yes' });
    const response = await fetch(`/api/projects?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: zipBytes as BlobPart,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : `The project could not be uploaded (status ${response.status}).`;
      throw new ApiError(response.status, message);
    }
    return body as ProjectSummary;
  },
  importGithub(input: {
    repo: string;
    ref?: string;
    name: string;
    consent: true;
  }): Promise<ProjectSummary> {
    return request('/projects/github', { method: 'POST', body: JSON.stringify(input) });
  },
  remove(id: string): Promise<void> {
    return request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const libraryApi = {
  get(): Promise<{ items: unknown[] }> {
    return request('/library');
  },
  save(items: unknown[]): Promise<{ count: number }> {
    return request('/library', { method: 'PUT', body: JSON.stringify({ items }) });
  },
};

// Above the worst case of the server's CLI checks: one 20 s probe for the provider list, and up to
// two 20 s probes for a Codex save (its model list, then its status). A slow but working server is
// therefore never cut off before it answers.
const PROVIDERS_TIMEOUT_MS = 45_000;

const providerPath = (provider: ProviderId, rest = ''): string =>
  `/ai/providers/${provider}${rest}`;

export const aiApi = {
  async providers(): Promise<ProvidersView> {
    // The server checks each CLI, so allow a generous time. A hung request must still end, so the
    // composer can show an error and offer Retry instead of staying disabled.
    const body = await request<unknown>('/ai/providers', {
      signal: AbortSignal.timeout(PROVIDERS_TIMEOUT_MS),
    });
    // An empty or malformed reply is an error, not a ready state with no data.
    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as { providers?: unknown }).providers)
    ) {
      throw new Error('The AI tools returned an unexpected response.');
    }
    return body as ProvidersView;
  },
  // A stalled save must end too, or the assistant would stay disabled while it waits.
  setDefault(provider: ProviderId): Promise<{ defaultProvider: ProviderId }> {
    return request('/ai/default', {
      method: 'PUT',
      body: JSON.stringify({ provider }),
      signal: AbortSignal.timeout(PROVIDERS_TIMEOUT_MS),
    });
  },
  saveSelection(provider: ProviderId, selection: ProviderSelection): Promise<ProviderView> {
    return request(providerPath(provider, '/selection'), {
      method: 'PUT',
      body: JSON.stringify(selection),
      signal: AbortSignal.timeout(PROVIDERS_TIMEOUT_MS),
    });
  },
  startLogin(provider: ProviderId): Promise<{ login: LoginFlow | null }> {
    return request(providerPath(provider, '/login'), { method: 'POST' });
  },
  loginStatus(provider: ProviderId): Promise<{ login: LoginFlow | null }> {
    return request(providerPath(provider, '/login'));
  },
  submitLoginCode(provider: ProviderId, code: string): Promise<{ login: LoginFlow | null }> {
    return request(providerPath(provider, '/login/code'), {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
  cancelLogin(provider: ProviderId): Promise<{ login: LoginFlow | null }> {
    return request(providerPath(provider, '/login'), { method: 'DELETE' });
  },
  generate(
    prompt: string,
    provider?: ProviderId,
  ): Promise<{ provider: ProviderId; graph: DiagramGraph }> {
    return request('/ai/generate', { method: 'POST', body: JSON.stringify({ prompt, provider }) });
  },
  chat(body: ChatRequest): Promise<ChatResponse> {
    return request('/ai/chat', { method: 'POST', body: JSON.stringify(body) });
  },
};

export interface ArchProjectInfo {
  id: string;
  label: string;
}

export interface ArchReviewFinding {
  severity: 'high' | 'medium' | 'low';
  title: string;
  evidence: string[];
  suggestion: string;
}

export interface ArchReview {
  summary: string;
  findings: ArchReviewFinding[];
}

export interface ArchReviewSidecar {
  version: 1;
  generatedAt: string;
  modelGeneratedAt: string;
  provider: ProviderId;
  review: ArchReview;
}

export const archApi = {
  projects(): Promise<{ projects: ArchProjectInfo[] }> {
    return request('/arch/projects');
  },
  model(name: string): Promise<{ model: ArchModel; layout: ArchLayout | null }> {
    return request(`/arch/models/${encodeURIComponent(name)}`);
  },
  review(name: string): Promise<{ review: ArchReviewSidecar | null; stale: boolean }> {
    return request(`/arch/models/${encodeURIComponent(name)}/review`);
  },
  runReview(name: string): Promise<{ review: ArchReviewSidecar; skipped: number }> {
    return request(`/arch/models/${encodeURIComponent(name)}/review`, { method: 'POST' });
  },
  findings(name: string): Promise<{ findings: ArchFinding[] }> {
    return request(`/arch/models/${encodeURIComponent(name)}/findings`);
  },
  scan(
    projectId: string,
    name: string,
  ): Promise<{ model: ArchModel; layout: ArchLayout | null; diff: ArchDiff }> {
    return request('/arch/scan', { method: 'POST', body: JSON.stringify({ projectId, name }) });
  },
  saveLayout(name: string, positions: ArchLayout['positions']): Promise<void> {
    return request(`/arch/models/${encodeURIComponent(name)}/layout`, {
      method: 'PUT',
      body: JSON.stringify({ version: 1, positions }),
    });
  },
  nameWithAi(name: string): Promise<{ model: ArchModel; applied: number }> {
    return request(`/arch/models/${encodeURIComponent(name)}/name`, { method: 'POST' });
  },
  resetLayout(name: string): Promise<void> {
    return request(`/arch/models/${encodeURIComponent(name)}/layout`, { method: 'DELETE' });
  },
};
