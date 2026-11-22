import type { ExcalidrawScene } from '../../shared/diagram.ts';

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
