/**
 * The surrounding context a work order is allowed to carry, and nothing more.
 *
 * "Contracts, not substance" applies to the work order itself, not just to the modules it
 * describes. An implementer needs its own substance and its neighbours' EDGES; sending a
 * neighbour's behaviour or test cases would contradict the name the product is built on.
 *
 * That rule is enforced structurally here rather than by discipline in the template. The
 * shapes below physically cannot hold a neighbour's behaviour, test cases or markdown
 * body — the renderer is never handed the data, so it cannot leak it even by accident.
 * If you are tempted to widen these interfaces, that is the moment to stop.
 */

import type { SpecNode, SpecNodeContractKind, SpecTree } from '@vousoir/typings';
import { resolveSpecNodeBehaviour, resolveSpecNodeContracts } from '../spec-store/resolve-spec-node.ts';
import { specNodeIdChain } from '../spec-store/spec-tree-walk.ts';

/** How a neighbour sits relative to the node being compiled. */
export type WorkOrderNeighbourRelation = 'parent' | 'sibling' | 'child';

/** An ancestor, reduced to orientation. Never its contracts, never its test cases. */
export interface WorkOrderAncestor {
	readonly id: string;
	readonly title: string;
	/** First paragraph of the ancestor's resolved behaviour, or `undefined` if it has none. */
	readonly summary: string | undefined;
}

/** One contract belonging to a neighbouring module: its edge, and nothing behind it. */
export interface WorkOrderNeighbourContract {
	readonly nodeId: string;
	readonly nodeTitle: string;
	readonly relation: WorkOrderNeighbourRelation;
	/** `undefined` for the deprecated scalar `contract`, which carries no name or kind. */
	readonly name: string | undefined;
	readonly kind: SpecNodeContractKind | undefined;
	readonly body: string;
}

/** Everything around the node that a work order may include. */
export interface WorkOrderContext {
	/** Outermost first: root → … → parent. Empty when the node is a root. */
	readonly ancestors: readonly WorkOrderAncestor[];
	/** Neighbour contracts, ordered parent → siblings → children, then by node id. */
	readonly neighbours: readonly WorkOrderNeighbourContract[];
}

const RELATION_ORDER: readonly WorkOrderNeighbourRelation[] = ['parent', 'sibling', 'child'];

/** Gathers the ancestors and neighbour contracts for `nodeId`. Pure; never touches disk. */
export function collectWorkOrderContext(tree: SpecTree, nodeId: string): WorkOrderContext {
	const chain = specNodeIdChain(tree, nodeId);
	const ancestors = chain
		.slice(0, -1)
		.map((ancestorId) => toAncestor(tree, ancestorId))
		.filter((ancestor): ancestor is WorkOrderAncestor => ancestor !== undefined);

	const neighbours = collectNeighbourNodes(tree, nodeId)
		.flatMap(([relation, node]) => toNeighbourContracts(relation, node))
		.sort(compareNeighbours);

	return { ancestors, neighbours };
}

/**
 * The neighbour set is **structural**: parent, siblings and children.
 *
 * That is an approximation, and a deliberate one. The model has no contract-link edges —
 * `contracts[]` is per-node with `id`/`kind`/`name`/`body` and no target reference — so
 * "directly-contracted neighbour" is not a question the data can answer yet. Structural
 * adjacency is the closest honest stand-in: the modules a node is most likely to call are
 * the ones it sits beside or inside.
 *
 * **Narrow this the moment link edges land.** Once a contract can name its counterparty,
 * this should return only genuinely contracted nodes, and the set will usually be smaller.
 * Until then a work order may carry a boundary its module never touches, which costs
 * prompt size and reader attention but leaks nothing — every entry is still only an edge.
 */
function collectNeighbourNodes(tree: SpecTree, nodeId: string): readonly [WorkOrderNeighbourRelation, SpecNode][] {
	const node = tree.byId.get(nodeId);
	if (node === undefined) {
		return [];
	}
	const parentId = node.frontmatter.parent;
	const found: [WorkOrderNeighbourRelation, SpecNode][] = [];
	for (const candidate of tree.byId.values()) {
		if (candidate.id === nodeId) {
			continue;
		}
		if (parentId !== null && candidate.id === parentId) {
			found.push(['parent', candidate]);
		} else if (candidate.frontmatter.parent === nodeId) {
			found.push(['child', candidate]);
		} else if (candidate.frontmatter.parent === parentId) {
			// Includes the co-root case (both parents `null`). The schema tolerates several
			// roots, and treating them as strangers rather than siblings would be a surprising
			// asymmetry — structurally they sit side by side like any other siblings.
			found.push(['sibling', candidate]);
		}
	}
	return found;
}

/** Projects a neighbour down to contract blocks. The projection is the guard rail. */
function toNeighbourContracts(
	relation: WorkOrderNeighbourRelation,
	node: SpecNode,
): readonly WorkOrderNeighbourContract[] {
	const { typed, legacy } = resolveSpecNodeContracts(node.frontmatter);
	const shared = { nodeId: node.id, nodeTitle: node.frontmatter.title, relation };
	if (typed.length > 0) {
		return typed.map((contract) => ({ ...shared, name: contract.name, kind: contract.kind, body: contract.body }));
	}
	// The deprecated scalar is still a real boundary; hiding it would hide a real edge.
	return legacy === undefined ? [] : [{ ...shared, name: undefined, kind: undefined, body: legacy }];
}

function toAncestor(tree: SpecTree, ancestorId: string): WorkOrderAncestor | undefined {
	const node = tree.byId.get(ancestorId);
	if (node === undefined) {
		return undefined;
	}
	return { id: node.id, title: node.frontmatter.title, summary: firstParagraph(resolveSpecNodeBehaviour(node)) };
}

/**
 * The first paragraph of a behaviour: orientation, not substance.
 *
 * Leading blank lines and leading markdown headings are skipped first — a body that opens
 * with `## Overview` would otherwise contribute a heading as its summary, which tells the
 * reader nothing.
 */
function firstParagraph(behaviour: string | undefined): string | undefined {
	if (behaviour === undefined) {
		return undefined;
	}
	const lines = behaviour.split(/\r?\n/);
	let start = 0;
	while (start < lines.length && (lines[start]?.trim() === '' || lines[start]?.trimStart().startsWith('#') === true)) {
		start += 1;
	}
	const paragraph: string[] = [];
	for (let index = start; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (line.trim() === '') {
			break;
		}
		paragraph.push(line.trim());
	}
	const summary = paragraph.join(' ').trim();
	return summary.length > 0 ? summary : undefined;
}

function compareNeighbours(left: WorkOrderNeighbourContract, right: WorkOrderNeighbourContract): number {
	const byRelation = RELATION_ORDER.indexOf(left.relation) - RELATION_ORDER.indexOf(right.relation);
	if (byRelation !== 0) {
		return byRelation;
	}
	const byNode = left.nodeId.localeCompare(right.nodeId);
	return byNode !== 0 ? byNode : (left.name ?? '').localeCompare(right.name ?? '');
}
