/**
 * The filename stem a work order is written under.
 *
 * Derived from the node `id`, never the title: ids are unique across the spec by
 * construction (the store rejects duplicates), so two nodes sharing a title still get
 * distinct files, and re-titling a node does not orphan its previous work order.
 *
 * Sanitising is lossy — `Foo Bar` and `foo bar` both reduce to `foo-bar` — so a short
 * digest of the raw id is appended whenever sanitising actually changed something. A
 * well-formed kebab id keeps a clean filename; anything else gets disambiguated.
 */

import { createHash } from 'node:crypto';

const DIGEST_LENGTH = 8;

/** Deterministic, filesystem-safe, collision-free stem for `nodeId`. */
export function workOrderSlug(nodeId: string): string {
	const sanitised = nodeId
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const digest = createHash('sha256').update(nodeId, 'utf8').digest('hex').slice(0, DIGEST_LENGTH);
	if (sanitised.length === 0) {
		return `node-${digest}`;
	}
	return sanitised === nodeId ? sanitised : `${sanitised}-${digest}`;
}
