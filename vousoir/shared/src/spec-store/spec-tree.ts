/**
 * Assembles the module tree from `parent` pointers.
 *
 * The pointers are the model; the folder nesting is a human-navigability convenience that
 * mirrors them (ADR-002: "`parent` wins"). So this is a pure function over loaded nodes
 * and never consults the filesystem — which is also what makes it directly testable.
 *
 * It refuses three shapes that a hand-edit can produce: a duplicate id, a `parent`
 * pointing at nothing, and a cycle. Each is reported against the file that caused it.
 */

import type { SpecNode, SpecTree, SpecTreeNode } from '@vousoir/typings';
import { SpecStoreError } from './spec-store-error.ts';

/** Builds the id index and the root-down tree. Throws `SpecStoreError` on an unusable spec set. */
export function buildSpecTree(nodes: readonly SpecNode[]): SpecTree {
	const byId = indexById(nodes);
	assertParentsResolve(nodes, byId);
	assertNoCycles(byId);

	const childrenOf = new Map<string, SpecNode[]>();
	const roots: SpecNode[] = [];
	for (const node of [...nodes].sort((left, right) => left.id.localeCompare(right.id))) {
		const parentId = node.frontmatter.parent;
		if (parentId === null) {
			roots.push(node);
			continue;
		}
		const siblings = childrenOf.get(parentId);
		if (siblings === undefined) {
			childrenOf.set(parentId, [node]);
		} else {
			siblings.push(node);
		}
	}

	const attach = (node: SpecNode): SpecTreeNode => ({
		...node,
		children: (childrenOf.get(node.id) ?? []).map(attach),
	});
	return { byId, roots: roots.map(attach) };
}

function indexById(nodes: readonly SpecNode[]): ReadonlyMap<string, SpecNode> {
	const byId = new Map<string, SpecNode>();
	for (const node of nodes) {
		const clash = byId.get(node.id);
		if (clash !== undefined) {
			throw new SpecStoreError(
				`declares id "${node.id}", which ${clash.filePath} already declares. Ids must be unique across .v6r/spec/.`,
				{ filePath: node.filePath },
			);
		}
		byId.set(node.id, node);
	}
	return byId;
}

function assertParentsResolve(nodes: readonly SpecNode[], byId: ReadonlyMap<string, SpecNode>): void {
	for (const node of nodes) {
		const parentId = node.frontmatter.parent;
		if (parentId !== null && !byId.has(parentId)) {
			throw new SpecStoreError(
				`names parent "${parentId}", but no node under .v6r/spec/ declares that id. ` +
					'Fix the `parent:` field, or restore the missing node.',
				{ filePath: node.filePath },
			);
		}
	}
}

/** Walks parents from every node; a repeat within one walk is a cycle. */
function assertNoCycles(byId: ReadonlyMap<string, SpecNode>): void {
	const acyclic = new Set<string>();
	for (const start of byId.keys()) {
		const seen = new Set<string>();
		let current: string | undefined = start;
		while (current !== undefined && !acyclic.has(current)) {
			const node = byId.get(current);
			if (seen.has(current)) {
				const trail = `${[...seen, current].join(' -> ')}`;
				const message = `is part of a parent cycle: ${trail}. A spec tree cannot contain a loop.`;
				throw new SpecStoreError(message, node === undefined ? {} : { filePath: node.filePath });
			}
			seen.add(current);
			current = node?.frontmatter.parent ?? undefined;
		}
		for (const id of seen) {
			acyclic.add(id);
		}
	}
}
