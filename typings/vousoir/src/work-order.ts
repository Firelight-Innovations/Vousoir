/**
 * A compiled work order: the self-contained markdown handed to a coding agent for one
 * spec node (source-of-truth Feature 4).
 *
 * Only the finished artefact is declared here. The intermediate shapes the compiler
 * assembles — ancestor summaries, neighbour contract blocks — stay private to
 * `@vousoir/shared`, because nothing outside the compiler should be able to reach for a
 * neighbour's data and render it somewhere else.
 */

/** One compiled work order, ready to review and dispatch. */
export interface WorkOrder {
	/** The spec node this was compiled from. Also stamped into the markdown frontmatter. */
	readonly nodeId: string;
	/** Filename stem under `.vousoir/cache/work-orders/`. Deterministic and collision-free. */
	readonly slug: string;
	/** The complete work order. Self-contained: it references no other file. */
	readonly markdown: string;
}
