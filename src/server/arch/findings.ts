import type { ArchModel, ArchNode } from '../../shared/arch-model.ts';
import {
  FINDING_KINDS,
  FINDING_LIMITS,
  findingId,
  type ArchFinding,
  type FindingKind,
} from '../../shared/arch-findings.ts';

const ROOT_ID = '.';

function makeFinding(
  kind: FindingKind,
  severity: ArchFinding['severity'],
  title: string,
  detail: string,
  nodeIds: readonly string[],
): ArchFinding {
  const nodes = [...nodeIds].sort();
  return { id: findingId(kind, nodes), kind, severity, title, detail, nodes };
}

function findCycles(nodes: readonly ArchNode[], model: ArchModel): ArchFinding[] {
  const componentIds = new Set(
    nodes.filter((node) => node.kind === 'component').map((node) => node.id),
  );
  const adjacency = new Map<string, string[]>();
  for (const id of componentIds) adjacency.set(id, []);
  for (const edge of model.edges) {
    if (componentIds.has(edge.from) && componentIds.has(edge.to)) {
      adjacency.get(edge.from)?.push(edge.to);
    }
  }

  let nextIndex = 0;
  const indexById = new Map<string, number>();
  const lowLinkById = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const findings: ArchFinding[] = [];

  const visit = (id: string): void => {
    const index = nextIndex++;
    indexById.set(id, index);
    lowLinkById.set(id, index);
    stack.push(id);
    onStack.add(id);

    for (const neighbor of adjacency.get(id) ?? []) {
      if (!indexById.has(neighbor)) {
        visit(neighbor);
        lowLinkById.set(
          id,
          Math.min(lowLinkById.get(id) ?? index, lowLinkById.get(neighbor) ?? index),
        );
      } else if (onStack.has(neighbor)) {
        lowLinkById.set(
          id,
          Math.min(lowLinkById.get(id) ?? index, indexById.get(neighbor) ?? index),
        );
      }
    }

    if (lowLinkById.get(id) !== indexById.get(id)) return;
    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop();
      if (member !== undefined) {
        onStack.delete(member);
        component.push(member);
      }
    } while (member !== id);

    const isSelfLoop = component.length === 1 && (adjacency.get(id) ?? []).includes(id);
    if (component.length > 1 || isSelfLoop) {
      const sorted = component.sort();
      findings.push(
        makeFinding(
          'cycle',
          'high',
          'Dependency cycle',
          `These components form a dependency cycle: ${sorted.join(', ')}.`,
          sorted,
        ),
      );
    }
  };

  for (const id of componentIds) {
    if (!indexById.has(id)) visit(id);
  }
  return findings;
}

function findComponentFindings(model: ArchModel): ArchFinding[] {
  const components = model.nodes.filter((node) => node.kind === 'component');
  const componentIds = new Set(components.map((node) => node.id));
  const fanIn = new Map<string, Set<string>>();
  const fanOut = new Map<string, Set<string>>();
  const incident = new Set<string>();

  for (const edge of model.edges) {
    if (componentIds.has(edge.from)) incident.add(edge.from);
    if (componentIds.has(edge.to)) incident.add(edge.to);
    if (componentIds.has(edge.from) && componentIds.has(edge.to)) {
      fanOut.set(edge.from, (fanOut.get(edge.from) ?? new Set()).add(edge.to));
      fanIn.set(edge.to, (fanIn.get(edge.to) ?? new Set()).add(edge.from));
    }
  }

  const findings: ArchFinding[] = [];
  for (const node of components) {
    const id = node.id;
    if (id !== ROOT_ID && !incident.has(id)) {
      findings.push(
        makeFinding('orphan', 'low', 'Isolated component', `${id} has no dependency edges.`, [id]),
      );
    }

    if (id !== ROOT_ID) {
      const incoming = fanIn.get(id)?.size ?? 0;
      const outgoing = fanOut.get(id)?.size ?? 0;
      if (incoming >= FINDING_LIMITS.hubDegree || outgoing >= FINDING_LIMITS.hubDegree) {
        findings.push(
          makeFinding(
            'hub',
            'medium',
            'Highly connected component',
            `${id} has fan-in ${incoming} and fan-out ${outgoing} across component dependencies.`,
            [id],
          ),
        );
      }
    }

    if (node.files >= FINDING_LIMITS.largeFolderFiles) {
      findings.push(
        makeFinding(
          'large-folder',
          'medium',
          'Large component folder',
          `${id} contains ${node.files} files (threshold: ${FINDING_LIMITS.largeFolderFiles}).`,
          [id],
        ),
      );
    }

    const deepMember = node.members.find(
      (path) => path.split('/').length - 1 > FINDING_LIMITS.maxFolderDepth,
    );
    if (deepMember) {
      findings.push(
        makeFinding(
          'deep-nesting',
          'low',
          'Deeply nested file',
          `${deepMember} is nested more than ${FINDING_LIMITS.maxFolderDepth} folders deep.`,
          [id],
        ),
      );
    }
  }
  return findings;
}

/** Computes deterministic structural findings from an architecture model. */
export function computeFindings(model: ArchModel): ArchFinding[] {
  const nodes = model.nodes;
  const findings = [...findCycles(nodes, model), ...findComponentFindings(model)];
  const kindOrder = new Map(FINDING_KINDS.map((kind, index) => [kind, index]));
  return findings.sort(
    (a, b) =>
      (kindOrder.get(a.kind) ?? 0) - (kindOrder.get(b.kind) ?? 0) || a.id.localeCompare(b.id),
  );
}
