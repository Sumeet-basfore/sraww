import { describe, expect, it } from 'vitest';
import { ARCH_LIMITS, type ArchModel, type ArchNode } from '../../src/shared/arch-model.ts';
import { FINDING_LIMITS } from '../../src/shared/arch-findings.ts';
import { computeFindings } from '../../src/server/arch/findings.ts';

const makeNode = (id: string, options: Partial<ArchNode> = {}): ArchNode => ({
  id,
  label: id,
  kind: 'component',
  group: id === '.' ? null : (id.split('/')[0] ?? id),
  files: 1,
  members: [`${id}/index.ts`],
  ...options,
});

const makeModel = (nodes: ArchNode[], edges: ArchModel['edges'] = []): ArchModel => ({
  version: 1,
  sourceLabel: 'test',
  generatedAt: '2026-11-23T00:00:00.000Z',
  nodes,
  edges,
  groups: [],
});

describe('computeFindings', () => {
  it('returns stable finding ids regardless of model input order', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges: ArchModel['edges'] = [
      { from: 'a', to: 'b', count: 1 },
      { from: 'b', to: 'a', count: 1 },
    ];
    const forward = computeFindings(makeModel(nodes, edges));
    const reversed = computeFindings(makeModel([...nodes].reverse(), [...edges].reverse()));
    expect(forward.map((finding) => finding.id)).toEqual(reversed.map((finding) => finding.id));
    expect(forward.every((finding) => finding.nodes.length > 0)).toBe(true);
  });

  it('finds a multi-node cycle and ignores an acyclic chain', () => {
    const model = makeModel(
      ['a', 'b', 'x', 'y', 'z'].map((id) => makeNode(id)),
      [
        { from: 'a', to: 'b', count: 1 },
        { from: 'b', to: 'a', count: 1 },
        { from: 'x', to: 'y', count: 1 },
        { from: 'y', to: 'z', count: 1 },
      ],
    );
    expect(computeFindings(model).filter((finding) => finding.kind === 'cycle')).toMatchObject([
      { kind: 'cycle', nodes: ['a', 'b'], severity: 'high' },
    ]);
  });

  it('detects a synthetic self-loop defensively', () => {
    const findings = computeFindings(
      makeModel([makeNode('c')], [{ from: 'c', to: 'c', count: 1 }]),
    );
    expect(findings.filter((finding) => finding.kind === 'cycle')).toMatchObject([
      { kind: 'cycle', nodes: ['c'] },
    ]);
  });

  it('ignores external and missing nodes while detecting cycles', () => {
    const findings = computeFindings(
      makeModel(
        [makeNode('a')],
        [
          { from: 'a', to: 'ext:pkg', count: 1 },
          { from: 'missing', to: 'a', count: 1 },
        ],
      ),
    );
    expect(findings.filter((finding) => finding.kind === 'cycle')).toEqual([]);
  });

  it('handles a chain at ARCH_LIMITS.maxComponents without overflowing', () => {
    const nodes = Array.from({ length: ARCH_LIMITS.maxComponents }, (_, index) =>
      makeNode(`n${index}`),
    );
    const edges = nodes.slice(1).map((node, index) => ({
      from: `n${index}`,
      to: node.id,
      count: 1,
    }));
    const findings = computeFindings(makeModel(nodes, edges));
    expect(findings.filter((finding) => finding.kind === 'cycle')).toEqual([]);
    expect(findings.every((finding) => finding.nodes.length > 0)).toBe(true);
  });

  it('flags only isolated non-root components as orphans', () => {
    const findings = computeFindings(
      makeModel(
        [makeNode('.'), makeNode('isolated'), makeNode('connected')],
        [{ from: 'connected', to: 'ext:pkg', count: 1 }],
      ),
    );
    expect(findings.filter((finding) => finding.kind === 'orphan')).toMatchObject([
      { kind: 'orphan', nodes: ['isolated'], severity: 'low' },
    ]);
  });

  it('flags component hubs using component fan-in and fan-out only', () => {
    const leaves = Array.from({ length: FINDING_LIMITS.hubDegree }, (_, index) => `leaf${index}`);
    const nodes = [
      makeNode('hub'),
      ...leaves.map((id) => makeNode(id)),
      makeNode('outHub'),
      ...Array.from({ length: 9 }, (_, index) => makeNode(`external-user${index}`)),
      makeNode('source'),
      makeNode('.'),
    ];
    const edges: ArchModel['edges'] = [
      ...leaves.map((id) => ({ from: id, to: 'hub', count: 1 })),
      ...leaves.map((id) => ({ from: 'outHub', to: id, count: 1 })),
      ...leaves.map((id) => ({ from: '.', to: id, count: 1 })),
      { from: 'hub', to: 'source', count: 1 },
      ...Array.from({ length: 9 }, (_, index) => ({
        from: `external-user${index}`,
        to: 'ext:popular',
        count: 1,
      })),
    ];
    const findings = computeFindings(
      makeModel(
        [
          ...nodes,
          {
            ...makeNode('ext:popular'),
            kind: 'external',
            members: [],
            files: 0,
          },
        ],
        edges,
      ),
    );
    expect(
      findings.filter((finding) => finding.kind === 'hub').map((finding) => finding.nodes[0]),
    ).toEqual(['hub', 'outHub']);
    expect(findings.some((finding) => finding.nodes.includes('ext:popular'))).toBe(false);
    expect(findings.some((finding) => finding.kind === 'hub' && finding.nodes.includes('.'))).toBe(
      false,
    );
    expect(findings.find((finding) => finding.kind === 'hub')?.detail).toContain('fan-in 8');
    expect(findings.find((finding) => finding.kind === 'hub')?.detail).toContain('fan-out 1');
    expect(
      findings.find((finding) => finding.kind === 'hub' && finding.nodes[0] === 'outHub')?.detail,
    ).toContain('fan-out 8');
  });

  it('flags large folders at 60 kept files and leaves repo calibration counts quiet', () => {
    const findings = computeFindings(
      makeModel([
        makeNode('quiet-server', { files: 46 }),
        makeNode('quiet-client', { files: 40 }),
        makeNode('large', { files: 163 }),
        makeNode('threshold', { files: FINDING_LIMITS.largeFolderFiles }),
      ]),
    );
    expect(
      findings.filter((finding) => finding.kind === 'large-folder').map((f) => f.nodes[0]),
    ).toEqual(['large', 'threshold']);
  });

  it('flags deep nesting from member path folder segments', () => {
    const findings = computeFindings(
      makeModel([
        makeNode('component', { members: ['a/b/c/d/e/f/g/h.ts'] }),
        makeNode('within-depth', { members: ['a/b/c/d/e/f/g.ts'] }),
      ]),
    );
    expect(findings.filter((finding) => finding.kind === 'deep-nesting')).toMatchObject([
      { kind: 'deep-nesting', nodes: ['component'], severity: 'low' },
    ]);
    expect(
      findings.some(
        (finding) => finding.kind === 'deep-nesting' && finding.nodes.includes('within-depth'),
      ),
    ).toBe(false);
  });

  it('returns no findings for a healthy connected three-node model', () => {
    expect(
      computeFindings(
        makeModel(
          ['a', 'b', 'c'].map((id) => makeNode(id)),
          [
            { from: 'a', to: 'b', count: 1 },
            { from: 'b', to: 'c', count: 1 },
          ],
        ),
      ),
    ).toEqual([]);
  });
});
