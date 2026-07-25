/**
 * Computes spec completeness for one node. Pure — node in, verdict out.
 *
 * Three requirements, and the argument for each:
 *
 * - **behaviour** — resolved through `resolveSpecNodeBehaviour`, so it counts whichever
 *   home the node actually uses. Without it a work order tells an agent nothing about
 *   what to build.
 * - **contracts** — at least one, counting the deprecated scalar. This applies to EVERY
 *   node, roots and parents included: "this module declares no boundary" is precisely the
 *   thing the product exists to surface, and exempting parents would hide it on exactly
 *   the nodes other modules are most likely to be composed against.
 * - **testCases** — at least one. `description` and `expected` are schema-required, so any
 *   present case is already well-formed; `given`/`when`/`then` stay optional refinements
 *   per ADR-008 and are deliberately NOT required here.
 *
 * Emptiness is measured after trimming, so a field containing only whitespace does not
 * count as specified — that is a field someone opened and abandoned, not one they wrote.
 */

import { SPEC_REQUIREMENTS, type SpecCompleteness, type SpecNode, type SpecRequirement } from '@vousoir/typings';
import { resolveSpecNodeBehaviour, resolveSpecNodeContracts } from '../spec-store/resolve-spec-node.ts';

/** What `node` has and has not specified. */
export function specCompleteness(node: SpecNode): SpecCompleteness {
	const satisfied = SPEC_REQUIREMENTS.filter((requirement) => isSatisfied(node, requirement));
	const missing = SPEC_REQUIREMENTS.filter((requirement) => !satisfied.includes(requirement));
	return {
		isSpecified: missing.length === 0,
		satisfied,
		missing,
		ratio: satisfied.length / SPEC_REQUIREMENTS.length,
	};
}

function isSatisfied(node: SpecNode, requirement: SpecRequirement): boolean {
	switch (requirement) {
		case 'behaviour':
			return hasText(resolveSpecNodeBehaviour(node));
		case 'contracts': {
			// The deprecated scalar counts: it is a real declared boundary, and a node is
			// not less specified for having been written before ADR-008.
			const { typed, legacy } = resolveSpecNodeContracts(node.frontmatter);
			return typed.some((contract) => hasText(contract.body)) || hasText(legacy);
		}
		case 'testCases':
			return (node.frontmatter.testCases ?? []).length > 0;
	}
}

function hasText(value: string | undefined): boolean {
	return value !== undefined && value.trim().length > 0;
}
