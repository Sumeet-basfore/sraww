import type { ExcalidrawScene } from '../../shared/diagram.ts';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import type { ChatOp, ChatRequest } from '../../shared/chat-schemas.ts';
import type { ArchDiff, ArchLayout, ArchModel } from '../../shared/arch-model.ts';
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

const providerPath = (provider: ProviderId, rest = ''): string =>
  `/ai/providers/${provider}${rest}`;

export const aiApi = {
  providers(): Promise<ProvidersView> {
    return request<ProvidersView>('/ai/providers');
  },
  setDefault(provider: ProviderId): Promise<{ defaultProvider: ProviderId }> {
    return request('/ai/default', { method: 'PUT', body: JSON.stringify({ provider }) });
  },
  saveSelection(provider: ProviderId, selection: ProviderSelection): Promise<ProviderView> {
    return request(providerPath(provider, '/selection'), {
      method: 'PUT',
      body: JSON.stringify(selection),
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

export const archApi = {
  projects(): Promise<{ projects: ArchProjectInfo[] }> {
    return request('/arch/projects');
  },
  model(name: string): Promise<{ model: ArchModel; layout: ArchLayout | null }> {
    return request(`/arch/models/${encodeURIComponent(name)}`);
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
