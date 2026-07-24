/**
 * The in-memory shape of a loaded spec node and the tree assembled from `parent`
 * pointers. Declared here rather than in the spec store because the canvas, the spec
 * panel, the work-order compiler and the MCP server all consume it, and §7.3 puts every
 * cross-package data shape in `@vousoir/typings`.
 *
 * These are plain interfaces, not zod schemas: nothing here is ever serialised. What
 * goes on disk is `specNodeFrontmatterSchema` plus a markdown body — see
 * `./spec-node-frontmatter.ts`.
 */

import type { SpecNodeFrontmatter } from './spec-node-frontmatter.ts';

/** One spec node as loaded from one `.md` file under `.v6r/spec/`. */
export interface SpecNode {
	/** Mirrors `frontmatter.id`. The stable identity; `parent` pointers reference it. */
	readonly id: string;
	/** Absolute path to the node's `.md` file. */
	readonly filePath: string;
	/** The validated YAML header. */
	readonly frontmatter: SpecNodeFrontmatter;
	/**
	 * The free-form markdown below the frontmatter: the node's behaviour, in prose.
	 * Preserved byte-for-byte across a load/save round trip.
	 */
	readonly body: string;
}

/**
 * A node with its subtree attached.
 *
 * `children` is DERIVED from `parent` pointers on every load and is never persisted —
 * a stored copy is a denormalisation that can disagree with the pointers (ADR-008).
 */
export interface SpecTreeNode extends SpecNode {
	readonly children: readonly SpecTreeNode[];
}

/** Every node in a `.v6r/spec/` directory, flat and as a tree. */
export interface SpecTree {
	/** Every node, keyed by id. */
	readonly byId: ReadonlyMap<string, SpecNode>;
	/**
	 * Nodes whose `parent` is `null`, each carrying its subtree. Normally exactly one;
	 * the schema permits more, and a mid-restructure spec directory can transiently
	 * have several, so this is an array rather than a single optional root.
	 */
	readonly roots: readonly SpecTreeNode[];
}
