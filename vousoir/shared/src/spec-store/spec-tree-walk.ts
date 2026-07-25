/**
 * The two walks over an assembled `SpecTree` that structural edits need: upward, to turn
 * a node into the id chain its file path is built from, and downward, to enumerate a
 * subtree.
 *
 * Downward is what makes re-parenting safe — moving a node under one of its own
 * descendants would detach that subtree from the root, so the descendant set is exactly
 * the set of forbidden new parents.
 */

import type { SpecNode, SpecTree } from '@vousoir/typings';
import { SpecStoreError } from './spec-store-error.ts';

/**
 * Root-to-node ids, inclusive: `['root', 'api', 'users']` for `users`. Feed it to
 * `specNodePaths` to get the node's file and child directory.
 */
export function specNodeIdChain(tree: SpecTree, id: string): readonly string[] {
	const chain: string[] = [];
	let current: string | null = id;
	while (current !== null) {
		const node: SpecNode | undefined = tree.byId.get(current);
		if (node === undefined) {
			throw new SpecStoreError(`there is no spec node with id "${current}".`);
		}
		chain.unshift(node.id);
		current = node.frontmatter.parent;
	}
	return chain;
}

/** Every id beneath `id`, excluding `id` itself. */
export function specNodeDescendantIds(tree: SpecTree, id: string): ReadonlySet<string> {
	const childrenOf = new Map<string, string[]>();
	for (const node of tree.byId.values()) {
		const parentId = node.frontmatter.parent;
		if (parentId === null) {
			continue;
		}
		const siblings = childrenOf.get(parentId);
		if (siblings === undefined) {
			childrenOf.set(parentId, [node.id]);
		} else {
			siblings.push(node.id);
		}
	}

	const descendants = new Set<string>();
	const queue = [...(childrenOf.get(id) ?? [])];
	while (queue.length > 0) {
		const next = queue.pop();
		if (next === undefined || descendants.has(next)) {
			continue;
		}
		descendants.add(next);
		queue.push(...(childrenOf.get(next) ?? []));
	}
	return descendants;
}
