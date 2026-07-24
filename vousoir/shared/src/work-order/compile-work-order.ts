/**
 * Compiles one spec node into a self-contained work order (source-of-truth Feature 4).
 *
 * A pure function: tree in, markdown out. No filesystem, no `vscode`, no clock, no
 * randomness — so the same tree always compiles to the same bytes, which is what makes a
 * golden-file test possible and what lets the user review a work order before dispatch
 * and trust that what they reviewed is what gets sent.
 *
 * Writing it to disk is a separate, deliberate step — see `write-work-order.ts`.
 */

import type { SpecTree, WorkOrder } from '@vousoir/typings';
import { SpecStoreError } from '../spec-store/spec-store-error.ts';
import { collectWorkOrderContext } from './work-order-context.ts';
import { workOrderSlug } from './work-order-slug.ts';
import { renderWorkOrder } from './work-order-template.ts';

/** Compiles the work order for `nodeId`. Throws `SpecStoreError` if the node is unknown. */
export function compileWorkOrder(tree: SpecTree, nodeId: string): WorkOrder {
	const node = tree.byId.get(nodeId);
	if (node === undefined) {
		throw new SpecStoreError(`cannot compile a work order: there is no spec node with id "${nodeId}".`);
	}
	const context = collectWorkOrderContext(tree, nodeId);
	return { nodeId, slug: workOrderSlug(nodeId), markdown: renderWorkOrder(node, context) };
}
