// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSection } from '../../src/client/arch/ReviewSection.tsx';
import type { ArchModel } from '../../src/shared/arch-model.ts';

const model: ArchModel = {
  version: 1,
  sourceLabel: 'Demo',
  generatedAt: 'time',
  nodes: [
    { id: 'src', label: 'src', kind: 'component', group: 'src', files: 1, members: ['src/a.ts'] },
    {
      id: 'src/lib',
      label: 'Library',
      kind: 'component',
      group: 'src',
      files: 1,
      members: ['src/lib/b.ts'],
    },
    { id: 'ext:fs', label: 'fs', kind: 'external', group: null, files: 0, members: [] },
  ],
  edges: [{ from: 'src', to: 'ext:fs', count: 1 }],
  groups: [],
};
const saved = {
  version: 1,
  generatedAt: 'later',
  modelGeneratedAt: 'time',
  provider: 'claude',
  review: {
    summary: 'Summary',
    findings: [
      {
        severity: 'high',
        title: 'Split source',
        evidence: ['src', 'src/lib'],
        suggestion: 'Split src by feature.',
      },
    ],
  },
};
const fetchMock = vi.fn();
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('ReviewSection', () => {
  it('shows the confirmation before sending, then renders returned findings', async () => {
    let resolvePost!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(json({ review: null, stale: false })).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    render(<ReviewSection name="demo" model={model} findingCount={1} />);
    await screen.findByRole('button', { name: 'Review with AI' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Review with AI' }));
    expect(
      screen.getByText(
        'Send 2 folders (paths and labels), 2 files (counts only), 1 import link and 1 finding. No file contents or file names.',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Confirm and send' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolvePost(json({ review: saved, skipped: 1 }));
    expect(await screen.findByText('Split source')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Evidence: src, Library')).toBeInTheDocument();
    expect(screen.getByText(/1 finding.*skipped/i)).toBeInTheDocument();
  });

  it('copies findings as a Markdown checklist', async () => {
    fetchMock.mockResolvedValueOnce(json({ review: saved, stale: false }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ReviewSection name="demo" model={model} findingCount={1} />);
    await screen.findByText('Split source');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await user.click(screen.getByRole('button', { name: 'Copy as Markdown' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        '- [ ] **Split source** (high): Split src by feature. Evidence: src, src/lib',
      ),
    );
  });

  it('hides a stale review and explains why', async () => {
    fetchMock.mockResolvedValueOnce(json({ review: saved, stale: true }));
    render(<ReviewSection name="demo" model={model} findingCount={1} />);
    expect(
      await screen.findByText('The map changed since this review. Run it again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Split source')).not.toBeInTheDocument();
  });

  it('hides a saved review when the loaded model timestamp changes', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ review: saved, stale: false }))
      .mockResolvedValueOnce(json({ review: saved, stale: true }));
    const { rerender } = render(<ReviewSection name="demo" model={model} findingCount={1} />);
    expect(await screen.findByText('Split source')).toBeInTheDocument();
    rerender(
      <ReviewSection name="demo" model={{ ...model, generatedAt: 'rescanned' }} findingCount={1} />,
    );
    expect(
      await screen.findByText('The map changed since this review. Run it again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Split source')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not offer to send until the findings it would include have loaded', async () => {
    fetchMock.mockResolvedValueOnce(json({ review: null, stale: false }));
    const user = userEvent.setup();
    render(<ReviewSection name="demo" model={model} findingCount={null} />);
    await user.click(await screen.findByRole('button', { name: 'Review with AI' }));
    expect(screen.getByText('Loading the findings for this map…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm and send' })).toBeDisabled();
  });
});
