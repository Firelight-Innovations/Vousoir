/**
 * The message protocol between the canvas webview and the extension host.
 *
 * Typed here, and validated on arrival, because a webview seam is the worst place in the
 * product to debug a shape mismatch: `postMessage` is fire-and-forget, a typo produces
 * silence rather than an error, and the only witness is a devtools console the user has to
 * be told how to open.
 *
 * The extension treats every inbound message as untrusted input and parses it. Anything
 * that fails validation is logged with the offending payload rather than ignored — a
 * silently dropped message is the exact failure this file exists to prevent.
 */

import { z } from 'zod';
import { canvasPositionSchema } from './canvas-layout.ts';

/** Messages the webview sends to the extension host. */
export const canvasInboundMessageSchema = z.discriminatedUnion('type', [
	/** The webview finished loading and is ready to receive a render. */
	z.object({ type: z.literal('ready') }),
	/** The user dragged a node. Persists to `layout.json` as a manual placement. */
	z.object({ type: z.literal('moveNode'), id: z.string().min(1), position: canvasPositionSchema }),
	/** The user selected a node; drives the spec panel in M3. */
	z.object({ type: z.literal('selectNode'), id: z.string().min(1).nullable() }),
	/** The user asked to re-run auto-layout, discarding manual placements. */
	z.object({ type: z.literal('tidy') }),
	/**
	 * The user dropped a node onto another. Re-parents through the M1 store, which owns
	 * cycle rejection — dropping a node onto its own descendant is refused there, not here.
	 * `parent: null` drops it onto empty canvas, making it a root.
	 */
	z.object({ type: z.literal('reparentNode'), id: z.string().min(1), parent: z.string().min(1).nullable() }),
	/** Drill in: show this subtree alone. `null` returns to the whole tree. */
	z.object({ type: z.literal('drillInto'), id: z.string().min(1).nullable() }),
	/** Create a module under `parent`; `null` creates a root. */
	z.object({ type: z.literal('createNode'), parent: z.string().min(1).nullable() }),
	/** Rename a module. Title only — ids are stable, so nothing moves on disk. */
	z.object({ type: z.literal('renameNode'), id: z.string().min(1) }),
	/** Delete a module. Orphans re-parent to the grandparent; roots are refused. */
	z.object({ type: z.literal('deleteNode'), id: z.string().min(1) }),
	/** Something went wrong in the webview; surfaced to the output channel. */
	z.object({ type: z.literal('error'), message: z.string() }),
]);
export type CanvasInboundMessage = z.infer<typeof canvasInboundMessageSchema>;

/**
 * Messages the extension host sends to the webview.
 *
 * Declared as a schema too, even though the extension is the trusted end. It costs one
 * object and it means the two directions are described in one place rather than one
 * described and one implied.
 */
export const canvasOutboundMessageSchema = z.discriminatedUnion('type', [
	/** A full render: every box, already laid out. The webview does no layout maths. */
	z.object({
		type: z.literal('render'),
		projectName: z.string(),
		width: z.number(),
		height: z.number(),
		boxes: z.array(
			z.object({
				id: z.string(),
				title: z.string(),
				status: z.string(),
				parentId: z.string().nullable(),
				x: z.number(),
				y: z.number(),
				width: z.number(),
				height: z.number(),
				depth: z.number(),
				manual: z.boolean(),
			}),
		),
	}),
	/** A human-readable problem to show in place of the canvas. */
	z.object({ type: z.literal('showError'), message: z.string() }),
	/**
	 * A transient notice — a refused re-parent, a deleted root. Shown on the canvas rather
	 * than as a modal, because these are recoverable and the user is mid-gesture.
	 */
	z.object({ type: z.literal('notice'), message: z.string() }),
]);
export type CanvasOutboundMessage = z.infer<typeof canvasOutboundMessageSchema>;
