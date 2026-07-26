/**
 * How complete a node's SPECIFICATION is — the fact behind the canvas badge.
 *
 * **Derived from content, never from `status`.** The `status` field is a claim the user
 * (or an agent) wrote down; completeness is a property of what is actually in the file.
 * A node can say `verified` and have no test cases, and the badge must show that.
 *
 * **Scoped to specification only.** This deliberately says nothing about whether a module
 * is `built` or `verified`. Both depend on questions the project has not answered: how
 * Vousoir runs a module's tests (open question 11), and whether `built` means "an agent
 * claimed success" or "the tests pass" (deferred from ADR-005). Inventing an answer here
 * would bake a guess into a badge the user reads as fact.
 */

/** The three things that make a module specified. */
export type SpecRequirement = 'behaviour' | 'contracts' | 'testCases';

/** Every requirement, in the order a panel should present them. */
export const SPEC_REQUIREMENTS: readonly SpecRequirement[] = ['behaviour', 'contracts', 'testCases'];

/** What a node has and has not specified. */
export interface SpecCompleteness {
	/** True only when nothing is missing. */
	readonly isSpecified: boolean;
	readonly satisfied: readonly SpecRequirement[];
	/**
	 * What is still missing, in `SPEC_REQUIREMENTS` order.
	 *
	 * Reported granularly rather than as a bare boolean on purpose: a badge that says
	 * "incomplete" without saying what is absent sends the user hunting through three
	 * sections to find out.
	 */
	readonly missing: readonly SpecRequirement[];
	/** Satisfied count over total, 0 to 1. For a progress ring or a "2 of 3" label. */
	readonly ratio: number;
}
