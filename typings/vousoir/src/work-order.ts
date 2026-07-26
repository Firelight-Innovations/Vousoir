/**
 * A compiled work order: the self-contained markdown handed to a coding agent for one
 * spec node (source-of-truth Feature 4), and the surrounding context it is allowed to
 * carry.
 *
 * These are zod schemas rather than plain interfaces because M6 exposes them over MCP, and
 * `vousoir-technical-spec.md:153` is explicit — *"All MCP tool inputs/outputs defined as
 * schemas (zod) … the schema is the contract"*. Declaring them once here and inferring the
 * types is what stops the compiler and the MCP server from drifting into two descriptions
 * of the same payload, which is the defect `PATCHES.md` A3 already records happening once.
 *
 * M4 kept the ancestor and neighbour shapes private to `@vousoir/shared`, on the grounds
 * that nothing outside the compiler should reach for a neighbour's data. M6 makes them a
 * published MCP payload, so they move here — but the shapes themselves are unchanged, and
 * they still cannot carry a neighbour's behaviour, body or test cases.
 */

import { z } from 'zod';
import { specNodeContractKindSchema } from './spec-node-frontmatter.ts';

/** One compiled work order, ready to review and dispatch. */
export const workOrderSchema = z.object({
	/** The spec node this was compiled from. Also stamped into the markdown frontmatter. */
	nodeId: z.string().min(1),
	/** Filename stem under `.vousoir/cache/work-orders/`. Deterministic and collision-free. */
	slug: z.string().min(1),
	/** The complete work order. Self-contained: it references no other file. */
	markdown: z.string(),
});
export type WorkOrder = z.infer<typeof workOrderSchema>;

/** How a neighbour sits relative to the node being compiled. */
export const workOrderNeighbourRelationSchema = z.enum(['parent', 'sibling', 'child']);
export type WorkOrderNeighbourRelation = z.infer<typeof workOrderNeighbourRelationSchema>;

/**
 * An ancestor, reduced to orientation. Never its contracts, never its test cases — an
 * implementer needs to know where a module sits, not how its parents work inside.
 */
export const workOrderAncestorSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	/** First paragraph of the ancestor's resolved behaviour. Absent if it has none. */
	summary: z.string().optional(),
});
export type WorkOrderAncestor = z.infer<typeof workOrderAncestorSchema>;

/**
 * One contract belonging to a neighbouring module: its edge, and nothing behind it.
 *
 * The absence of `behaviour`, `testCases` and a markdown body here is the point, not an
 * oversight. "Contracts, not substance" applies to what an agent is handed, so this shape
 * is physically incapable of carrying a neighbour's internals.
 */
export const workOrderNeighbourContractSchema = z.object({
	nodeId: z.string().min(1),
	nodeTitle: z.string().min(1),
	relation: workOrderNeighbourRelationSchema,
	/** Absent for the deprecated scalar `contract`, which carries no name or kind. */
	name: z.string().optional(),
	kind: specNodeContractKindSchema.optional(),
	body: z.string(),
});
export type WorkOrderNeighbourContract = z.infer<typeof workOrderNeighbourContractSchema>;
