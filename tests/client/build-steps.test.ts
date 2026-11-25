import { describe, expect, it } from 'vitest';
import type { DiagramGraph } from '../../src/shared/ai-schemas.ts';
import type { Layout } from '../../src/client/ai/layout.ts';
import { layoutGraph } from '../../src/client/ai/layout.ts';
import { graphToSkeleton, originOf } from '../../src/client/ai/skeleton.ts';
import { planBuild, visibleScene } from '../../src/client/learn/build-steps.ts';

function graph(nodes: DiagramGraph['nodes'], edges: DiagramGraph['edges'] = []): DiagramGraph {
  return { nodes, edges, direction: null, title: null };
}

function nodeIdsOf(steps: ReturnType<typeof planBuild>): string[] {
  return steps.flatMap((step) => step.nodeIds);
}

function layoutFor(ids: string[], groups: string[] = []): Layout {
  const boxes = new Map(
    ids.map((id, index) => [id, { x: index * 200, y: 0, width: 160, height: 60 }] as const),
  );
  const frames = new Map(
    groups.map(
      (name, index) => [name, { x: index * 400, y: -40, width: 300, height: 200 }] as const,
    ),
  );
  return { boxes, frames };
}

describe('planBuild order', () => {
  it('places each node after the nodes it depends on', () => {
    const steps = planBuild(
      graph(
        [
          { id: 'deploy', label: 'Deploy' },
          { id: 'build', label: 'Build' },
          { id: 'test', label: 'Test' },
        ],
        [
          { from: 'build', to: 'test' },
          { from: 'test', to: 'deploy' },
        ],
      ),
    );
    expect(nodeIdsOf(steps)).toEqual(['build', 'test', 'deploy']);
  });

  it('breaks ties by declaration order, taking the earliest ready node first', () => {
    const steps = planBuild(
      graph(
        [
          { id: 'x', label: 'X' },
          { id: 'y', label: 'Y' },
          { id: 'z', label: 'Z' },
        ],
        [{ from: 'z', to: 'x' }],
      ),
    );
    expect(nodeIdsOf(steps)).toEqual(['y', 'z', 'x']);
  });

  it('gives the same order every time for the same graph', () => {
    const lesson = graph(
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      [{ from: 'c', to: 'a' }],
    );
    expect(planBuild(lesson)).toEqual(planBuild(lesson));
  });

  it('still places every node exactly once when the arrows form a cycle', () => {
    const steps = planBuild(
      graph(
        [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      ),
    );
    const placed = nodeIdsOf(steps);
    expect([...placed].sort()).toEqual(['a', 'b', 'c']);
    expect(placed).toHaveLength(3);
  });

  it('treats a node joined to itself as placed once, with its own step', () => {
    const steps = planBuild(
      graph([{ id: 'loop', label: 'Retry' }], [{ from: 'loop', to: 'loop', label: 'again' }]),
    );
    expect(steps).toEqual([{ nodeIds: ['loop'], groups: [], edgeIndexes: [0] }]);
  });
});

describe('planBuild edges and groups', () => {
  it('reveals an edge only in the step where its second end appears', () => {
    const steps = planBuild(
      graph(
        [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      ),
    );
    expect(steps.map((step) => step.edgeIndexes)).toEqual([[], [0], [1]]);
  });

  it('never reveals an edge whose end is not a node', () => {
    const steps = planBuild(
      graph(
        [{ id: 'a', label: 'A' }],
        [
          { from: 'a', to: 'ghost' },
          { from: 'ghost', to: 'a' },
        ],
      ),
    );
    expect(steps.flatMap((step) => step.edgeIndexes)).toEqual([]);
  });

  it('shows a group frame in the step of its first node, and only once', () => {
    const steps = planBuild(
      graph([
        { id: 'api', label: 'API', group: 'Backend' },
        { id: 'web', label: 'Web' },
        { id: 'db', label: 'DB', group: 'Backend' },
      ]),
    );
    expect(steps[0]).toMatchObject({ nodeIds: ['api'], groups: ['Backend'] });
    expect(steps[2]?.groups).toEqual([]);
  });

  it('does not bring a group frame in for a note that belongs to it', () => {
    const steps = planBuild(
      graph([
        { id: 'note', label: 'Retries: 3', shape: 'note', group: 'Backend' },
        { id: 'api', label: 'API', group: 'Backend' },
      ]),
    );
    expect(steps[0]).toMatchObject({ nodeIds: ['note'], groups: [] });
    expect(steps[1]).toMatchObject({ nodeIds: ['api'], groups: ['Backend'] });
  });

  it('gives a note its own step, as it does any other node', () => {
    const steps = planBuild(
      graph(
        [
          { id: 'api', label: 'API' },
          { id: 'note', label: 'Retries: 3', shape: 'note' },
        ],
        [{ from: 'api', to: 'note', arrow: 'none' }],
      ),
    );
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ nodeIds: ['note'], edgeIndexes: [0] });
  });
});

describe('planBuild batching', () => {
  it('shows one node per step by default', () => {
    const steps = planBuild(
      graph([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]),
    );
    expect(steps.map((step) => step.nodeIds)).toEqual([['a'], ['b']]);
  });

  it('batches nodes in twos when asked, with the last batch possibly short', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id.toUpperCase() }));
    const steps = planBuild(graph(nodes), { nodesPerStep: 2 });
    expect(steps.map((step) => step.nodeIds)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });
});

describe('visibleScene', () => {
  const lesson = graph(
    [
      { id: 'api', label: 'API', group: 'Backend' },
      { id: 'db', label: 'DB', group: 'Backend' },
      { id: 'web', label: 'Web' },
    ],
    [
      { from: 'web', to: 'api' },
      { from: 'api', to: 'db' },
    ],
  );
  const layout = layoutFor(['api', 'db', 'web'], ['Backend']);
  const steps = planBuild(lesson);

  it('is empty before any step is shown', () => {
    const scene = visibleScene(lesson, layout, steps, 0);
    expect(scene.graph.nodes).toEqual([]);
    expect(scene.graph.edges).toEqual([]);
    expect(scene.layout.frames.size).toBe(0);
  });

  it('keeps only the revealed nodes, edges and frames', () => {
    const scene = visibleScene(lesson, layout, steps, 2);
    expect(scene.graph.nodes.map((node) => node.id)).toEqual(['api', 'web']);
    expect(scene.graph.edges).toEqual([{ from: 'web', to: 'api' }]);
    expect([...scene.layout.frames.keys()]).toEqual(['Backend']);
  });

  it('keeps the layout boxes of the whole drawing so nothing moves', () => {
    const scene = visibleScene(lesson, layout, steps, 1);
    expect(scene.layout.boxes).toBe(layout.boxes);
  });

  it('matches the full graph once every step is shown', () => {
    const scene = visibleScene(lesson, layout, steps, steps.length);
    expect(scene.graph.nodes).toEqual(lesson.nodes);
    expect(scene.graph.edges).toEqual(lesson.edges);
    expect([...scene.layout.frames.keys()]).toEqual(['Backend']);
  });
});

describe('a part of the build on a real layout', () => {
  it('keeps the title where the whole drawing puts it while frames and nodes arrive', async () => {
    const lesson = {
      ...graph(
        [
          { id: 'web', label: 'Web' },
          { id: 'api', label: 'API', group: 'Backend' },
          { id: 'db', label: 'DB', group: 'Backend' },
        ],
        [
          { from: 'web', to: 'api' },
          { from: 'api', to: 'db' },
        ],
      ),
      title: 'Requests',
    };
    const layout = await layoutGraph(lesson);
    const steps = planBuild(lesson);
    const titleAt = (shown: number) => {
      const scene = visibleScene(lesson, layout, steps, shown);
      const skeleton = graphToSkeleton(scene.graph, scene.layout, originOf(layout));
      return skeleton.find((el) => el.type === 'text' && el.text === 'Requests');
    };
    const whole = titleAt(steps.length);
    expect(titleAt(1)).toMatchObject({ x: whole?.x, y: whole?.y });
    expect(whole).toBeDefined();
  });
});
