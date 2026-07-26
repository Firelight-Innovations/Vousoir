/**
 * The two precedence rules a reader of a spec node must apply, written once.
 *
 * ADR-008 is explicit about why this lives in one place: two ways to express a contract
 * exist during the deprecation window, and "write the precedence rule once, in the reader,
 * and do not duplicate it per consumer". The canvas, the spec panel, the work-order
 * compiler and the MCP server all call these rather than re-deriving them.
 *
 * Neither rule ever MOVES text between the two forms. A file that puts its behaviour in
 * frontmatter keeps it there across a save; a file that puts it in the body keeps it in
 * the body. Rewriting on read would turn every first save into a whole-file diff.
 */

import type { SpecNode, SpecNodeContract, SpecNodeFrontmatter } from '@vousoir/typings';

/** A node's contracts, with the deprecated scalar kept distinct rather than faked into the array. */
export interface ResolvedSpecNodeContracts {
	/** Typed contracts, from `contracts`. Empty when the node only has the legacy scalar. */
	readonly typed: readonly SpecNodeContract[];
	/**
	 * The deprecated free-form `contract` string, surfaced only when no typed `contracts`
	 * field is present. It has no `kind`, so it is never silently promoted into `typed` —
	 * inventing a kind for it would put an unverified claim into a work order.
	 */
	readonly legacy: string | undefined;
}

/** Applies the ADR-008 precedence: `contracts` wins whenever it is present at all. */
export function resolveSpecNodeContracts(frontmatter: SpecNodeFrontmatter): ResolvedSpecNodeContracts {
	if (frontmatter.contracts !== undefined) {
		return { typed: frontmatter.contracts, legacy: undefined };
	}
	return { typed: [], legacy: frontmatter.contract };
}

/**
 * The node's behaviour prose: the markdown body when it has content, otherwise the
 * frontmatter `behaviour` field.
 *
 * The body is the primary home — it is what a user editing the `.md` by hand will write
 * into, and it is not length-constrained by YAML quoting. The frontmatter field is the
 * shipped form and stays valid, so both are read and neither is rewritten.
 */
export function resolveSpecNodeBehaviour(node: SpecNode): string | undefined {
	const body = node.body.trim();
	return body.length > 0 ? body : node.frontmatter.behaviour;
}
