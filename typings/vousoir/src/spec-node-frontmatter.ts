/**
 * Frontmatter schema for a spec-tree node: the YAML header of one `.md` file under
 * `.v6r/spec/` (work order §8). Nested folders under `spec/` mirror the module hierarchy;
 * this schema covers only the structured frontmatter header, not the free-form markdown
 * body below it.
 */

import { z } from 'zod';

/**
 * Lifecycle status of a spec node: a node moves left-to-right as its behaviour is
 * specified, then built, then verified. `unspecified` is the initial state for a
 * freshly created node that has only a title.
 */
export const specNodeStatusSchema = z.enum(['unspecified', 'specified', 'building', 'built', 'verified']);
export type SpecNodeStatus = z.infer<typeof specNodeStatusSchema>;

/** One acceptance test case attached to a spec node. */
export const specNodeTestCaseSchema = z.object({
	id: z.string().min(1),
	description: z.string().min(1),
	expected: z.string().min(1),
});
export type SpecNodeTestCase = z.infer<typeof specNodeTestCaseSchema>;

/** The YAML frontmatter of one spec-tree node .md file. */
export const specNodeFrontmatterSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	/** Id of the parent node, or `null` for the tree root. */
	parent: z.string().min(1).nullable(),
	status: specNodeStatusSchema,
	/** Free-form description of what this node should do. */
	behaviour: z.string().optional(),
	/** The node's contract with its siblings/parent: inputs, outputs, invariants. */
	contract: z.string().optional(),
	testCases: z.array(specNodeTestCaseSchema).optional(),
});
export type SpecNodeFrontmatter = z.infer<typeof specNodeFrontmatterSchema>;
