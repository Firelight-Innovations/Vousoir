/**
 * Frontmatter schema for a spec-tree node: the YAML header of one `.md` file under
 * `.v6r/spec/` (work order §8). Nested folders under `spec/` mirror the module hierarchy;
 * this schema covers only the structured frontmatter header, not the free-form markdown
 * body below it.
 *
 * Extended additively by M1 per ADR-008: every field added here is optional, so every
 * spec file written before M1 stays valid and no migration exists. Nothing in this file
 * describes a module's INTERNAL implementation — a node carries behaviour, boundary
 * contracts and test cases only ("edges, not substance"). A field for internals would be
 * the one thing the product refuses to model.
 */

import { z } from 'zod';

/**
 * Lifecycle status of a spec node: a node moves left-to-right as its behaviour is
 * specified, then built, then verified. `unspecified` is the initial state for a
 * freshly created node that has only a title.
 */
export const specNodeStatusSchema = z.enum(['unspecified', 'specified', 'building', 'built', 'verified']);
export type SpecNodeStatus = z.infer<typeof specNodeStatusSchema>;

/**
 * The three kinds of boundary a module can declare, from
 * `vousoir-source-of-truth.md:186` ("contract verification mechanics per contract type").
 * This is the discriminator the deferred contract linter (Feature 8) will branch on.
 */
export const specNodeContractKindSchema = z.enum(['moduleApi', 'serviceApi', 'dbSchema']);
export type SpecNodeContractKind = z.infer<typeof specNodeContractKindSchema>;

/** One typed boundary contract attached to a spec node (ADR-008). */
export const specNodeContractSchema = z.object({
	/** Stable identity, unique within the node. Referenced by work orders and the linter. */
	id: z.string().min(1),
	kind: specNodeContractKindSchema,
	/** Human label — the operation, endpoint or table this contract governs. */
	name: z.string().min(1),
	/**
	 * The contract itself, as free-form text: signatures, endpoints, columns, invariants.
	 *
	 * Deliberately unstructured for M1 (ADR open question 4, proposed resolution). It can
	 * become a per-kind structured shape later — a `z.discriminatedUnion('kind', …)` whose
	 * branches each parse their own body — WITHOUT breaking existing files, because a
	 * structured reader can still accept the string form as the unparsed fallback. Give it
	 * structure only when the contract linter needs to parse it.
	 *
	 * May be empty: a contract can be named on the canvas before it is written.
	 */
	body: z.string(),
});
export type SpecNodeContract = z.infer<typeof specNodeContractSchema>;

/**
 * One acceptance test case attached to a spec node.
 *
 * `description` and `expected` stay REQUIRED — they are the shipped shape and every
 * existing spec file has them. The Given/When/Then triple and `snippet` are optional
 * refinements for cases that warrant the longer form.
 */
export const specNodeTestCaseSchema = z.object({
	id: z.string().min(1),
	description: z.string().min(1),
	expected: z.string().min(1),
	/** Precondition: the state the system is in before the behaviour under test. */
	given: z.string().optional(),
	/** Trigger: the action taken. */
	when: z.string().optional(),
	/** Observable outcome. Narrows `expected`; it does not replace it. */
	then: z.string().optional(),
	/** Concrete code or payload illustrating the case. Still an edge, not an internal. */
	snippet: z.string().optional(),
});
export type SpecNodeTestCase = z.infer<typeof specNodeTestCaseSchema>;

/** The YAML frontmatter of one spec-tree node .md file. */
export const specNodeFrontmatterSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	/** Id of the parent node, or `null` for the tree root. */
	parent: z.string().min(1).nullable(),
	status: specNodeStatusSchema,
	/**
	 * Free-form description of what this node should do. British spelling is the shipped,
	 * tested field name — do NOT "fix" it to `behavior` (ADR open question 6). Use
	 * "Behavior" in UI labels and prose instead.
	 */
	behaviour: z.string().optional(),
	/**
	 * @deprecated Superseded by `contracts` (ADR-008). Still accepted, and still written
	 * back untouched, so every file authored before M1 stays valid with no migration.
	 * Precedence when both are present is `contracts` — see `resolveSpecNodeContracts`.
	 */
	contract: z.string().optional(),
	/** Typed boundary contracts. The node's edges: what crosses its boundary. */
	contracts: z.array(specNodeContractSchema).optional(),
	testCases: z.array(specNodeTestCaseSchema).optional(),
});
export type SpecNodeFrontmatter = z.infer<typeof specNodeFrontmatterSchema>;
