/**
 * The message protocol between the spec panel webview and the extension host.
 *
 * Same discipline as the canvas seam: both directions declared, and every inbound message
 * parsed on arrival. The panel is where a shape mismatch would be most expensive — a
 * dropped save looks exactly like a save that worked.
 */

import { z } from 'zod';
import { specNodeContractSchema, specNodeTestCaseSchema } from './spec-node-frontmatter.ts';

/** Messages the panel sends to the extension host. */
export const specPanelInboundMessageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('ready') }),
	/**
	 * Save the whole spec for the selected node. Sent on an explicit Save, never per
	 * keystroke: a save writes a file, and a file write per character would fight the
	 * watcher and fill git with noise.
	 */
	z.object({
		type: z.literal('save'),
		id: z.string().min(1),
		title: z.string().min(1),
		behaviour: z.string(),
		contracts: z.array(specNodeContractSchema),
		testCases: z.array(specNodeTestCaseSchema),
	}),
	/** The user started editing. Suppresses reload-on-external-change until they save. */
	z.object({ type: z.literal('dirty'), dirty: z.boolean() }),
	/** Open the node's markdown file in a normal editor. */
	z.object({ type: z.literal('openFile'), id: z.string().min(1) }),
	z.object({ type: z.literal('error'), message: z.string() }),
]);
export type SpecPanelInboundMessage = z.infer<typeof specPanelInboundMessageSchema>;

/** One module's full spec, as the panel renders it. */
export const specPanelNodeSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.string(),
	/** Resolved through the ADR-002 precedence, so the panel shows what actually wins. */
	behaviour: z.string(),
	/**
	 * True when this node's behaviour lives in the deprecated frontmatter field. The panel
	 * says so, because editing it writes back there rather than migrating to the body.
	 */
	behaviourInFrontmatter: z.boolean(),
	contracts: z.array(specNodeContractSchema),
	testCases: z.array(specNodeTestCaseSchema),
	filePath: z.string(),
	/** Derived from content, never from `status`. */
	missing: z.array(z.enum(['behaviour', 'contracts', 'testCases'])),
	isSpecified: z.boolean(),
});

/** Messages the extension host sends to the panel. */
export const specPanelOutboundMessageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('showNode'), node: specPanelNodeSchema }),
	/** Nothing selected, or the selection no longer exists. */
	z.object({ type: z.literal('showEmpty'), message: z.string() }),
	z.object({ type: z.literal('saved'), message: z.string() }),
	/**
	 * The file changed on disk while the user was editing. The panel warns rather than
	 * reloading — see the provider for why overwriting an in-progress edit is worse.
	 */
	z.object({ type: z.literal('externalChange'), message: z.string() }),
	z.object({ type: z.literal('showError'), message: z.string() }),
]);
export type SpecPanelOutboundMessage = z.infer<typeof specPanelOutboundMessageSchema>;
