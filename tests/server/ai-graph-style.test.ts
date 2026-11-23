import { describe, expect, it } from 'vitest';
import { normalizeGraph } from '../../src/server/ai/normalize-graph.ts';
import { validateChatReply } from '../../src/server/ai/chat.ts';
import { diagramGraphSchema } from '../../src/shared/ai-schemas.ts';
import { chatOpSchema, chatReplySchema } from '../../src/shared/chat-schemas.ts';

describe('graph style fields', () => {
  it('keeps shapes, colours, line styles, arrow heads, direction and title', () => {
    const graph = diagramGraphSchema.parse({
      nodes: [
        { id: 'api', label: 'API', shape: 'rounded', color: 'blue', group: 'Backend' },
        { id: 'note', label: 'Read first', shape: 'note', color: null, group: null },
      ],
      edges: [{ from: 'api', to: 'note', label: 'docs', style: 'dashed', arrow: 'none' }],
      direction: 'right',
      title: 'Payments',
    });
    const out = normalizeGraph(graph);
    expect(out.nodes[0]).toMatchObject({ shape: 'rounded', color: 'blue', group: 'Backend' });
    expect(out.edges[0]).toMatchObject({ style: 'dashed', arrow: 'none', label: 'docs' });
    expect(out.direction).toBe('right');
    expect(out.title).toBe('Payments');
  });

  it('rejects colours and line styles the drawing does not know', () => {
    expect(
      diagramGraphSchema.safeParse({
        nodes: [{ id: 'a', label: 'A', color: 'pink' }],
        edges: [],
      }).success,
    ).toBe(false);
    expect(
      diagramGraphSchema.safeParse({
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'a', to: 'a', style: 'wavy' }],
      }).success,
    ).toBe(false);
  });

  it('accepts a graph from an older answer that has none of the new fields', () => {
    const parsed = diagramGraphSchema.parse({ nodes: [{ id: 'a', label: 'A' }], edges: [] });
    expect(normalizeGraph(parsed).nodes[0]).toMatchObject({ id: 'a' });
  });
});

describe('updateNodes chat operation', () => {
  it('keeps a relabel and recolour for shapes that exist', () => {
    const reply = chatReplySchema.parse({
      reply: 'Done.',
      ops: [{ type: 'updateNodes', updates: [{ id: 'api', label: 'Gateway', color: 'green' }] }],
    });
    const out = validateChatReply(reply, new Set(['api']));
    expect(out.ops).toEqual([
      { type: 'updateNodes', updates: [{ id: 'api', label: 'Gateway', color: 'green' }] },
    ]);
    expect(out.rejected).toEqual([]);
  });

  it('rejects changes to shapes that are not in the diagram', () => {
    const reply = chatReplySchema.parse({
      reply: 'Done.',
      ops: [{ type: 'updateNodes', updates: [{ id: 'ghost', color: 'red' }] }],
    });
    const out = validateChatReply(reply, new Set(['api']));
    expect(out.ops).toEqual([]);
    expect(out.rejected[0]).toMatch(/Cannot change "ghost"/);
  });

  it('requires at least one update', () => {
    expect(chatOpSchema.safeParse({ type: 'updateNodes', updates: [] }).success).toBe(false);
  });
});
