/**
 * Allocates a spec-node id that is free in a given tree.
 *
 * Ids are permanent: they are what `parent` pointers reference and what a node's file is
 * named, so the canvas cannot let the user pick one that already exists and it cannot
 * quietly reuse one. Derived from the title for readability, then suffixed until free.
 *
 * Kept separate from the store because it is a pure function of the tree and a title,
 * which makes the collision behaviour directly testable.
 */

import type { SpecTree } from '@vousoir/typings';

const FALLBACK_STEM = 'module';

/** A filesystem-safe, unique id derived from `title`. */
export function uniqueNodeId(tree: SpecTree, title: string): string {
	const stem = slugify(title);
	if (!tree.byId.has(stem)) {
		return stem;
	}
	// Start at 2: "api" then "api-2" reads as a second one, where "api-1" implies a first.
	for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
		const candidate = `${stem}-${suffix}`;
		if (!tree.byId.has(candidate)) {
			return candidate;
		}
	}
	/* c8 ignore next */
	throw new Error('exhausted every id suffix');
}

function slugify(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug.length > 0 ? slug : FALLBACK_STEM;
}
