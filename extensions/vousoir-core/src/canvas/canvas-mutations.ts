/**
 * The canvas's structural edits: create, rename, delete, re-parent.
 *
 * **Every one routes through the M1 `SpecStore`.** The canvas invents no semantics of its
 * own — delete re-parents orphans to the grandparent and refuses a root, re-parent refuses
 * a cycle, ids stay unique — because those rules are already decided, tested, and shared
 * with the MCP server. A second set of rules on the canvas would be a second source of
 * truth for the same question.
 *
 * A refusal comes back as a notice the canvas shows in place, not as a thrown error: the
 * user is mid-gesture, and "you cannot drop a module inside itself" is information, not a
 * failure.
 */

import * as vscode from 'vscode';
import { SpecStore, uniqueNodeId } from '@vousoir/shared';
import type { CanvasInboundMessage } from '@vousoir/typings';

/** What a mutation produced: a notice to show, and whether the canvas must redraw. */
export interface MutationOutcome {
	readonly notice: string | undefined;
	readonly changed: boolean;
}

const UNCHANGED: MutationOutcome = { notice: undefined, changed: false };

/** Applies one structural message. Returns what to tell the user, if anything. */
export async function applyCanvasMutation(repoRoot: string, message: CanvasInboundMessage): Promise<MutationOutcome> {
	const store = await SpecStore.open({ repoRoot });
	try {
		switch (message.type) {
			case 'createNode':
				return await createNode(store, message.parent);
			case 'renameNode':
				return await renameNode(store, message.id);
			case 'deleteNode':
				return await deleteNode(store, message.id);
			case 'reparentNode':
				return await reparentNode(store, message.id, message.parent);
			default:
				return UNCHANGED;
		}
	} catch (error) {
		// SpecStoreError messages are already written for a human and name the file or the
		// rule that refused; surfacing them verbatim beats wrapping them in something vaguer.
		return { notice: describe(error), changed: false };
	} finally {
		store.dispose();
	}
}

async function createNode(store: SpecStore, parent: string | null): Promise<MutationOutcome> {
	const title = await vscode.window.showInputBox({
		title: parent === null ? 'New root module' : `New module inside "${titleOf(store, parent)}"`,
		prompt: 'What does this module do? You can refine the spec afterwards.',
		placeHolder: 'Task API',
		validateInput: (value) => (value.trim().length === 0 ? 'A module needs a title.' : undefined),
	});
	if (title === undefined) {
		return UNCHANGED;
	}
	// The id is derived once, here, and is permanent — it names the file and is what every
	// `parent` pointer references. The title stays freely editable.
	const id = uniqueNodeId(store.tree, title);
	await store.create({ id, title: title.trim(), parent });
	return { notice: `Created "${title.trim()}".`, changed: true };
}

async function renameNode(store: SpecStore, id: string): Promise<MutationOutcome> {
	const current = store.tree.byId.get(id);
	if (current === undefined) {
		return { notice: `There is no module with id "${id}".`, changed: false };
	}
	const title = await vscode.window.showInputBox({
		title: 'Rename module',
		value: current.frontmatter.title,
		prompt: 'The id and the file on disk do not change, so nothing moves.',
		validateInput: (value) => (value.trim().length === 0 ? 'A module needs a title.' : undefined),
	});
	if (title === undefined || title.trim() === current.frontmatter.title) {
		return UNCHANGED;
	}
	await store.rename(id, title.trim());
	return { notice: undefined, changed: true };
}

async function deleteNode(store: SpecStore, id: string): Promise<MutationOutcome> {
	const node = store.tree.byId.get(id);
	if (node === undefined) {
		return { notice: `There is no module with id "${id}".`, changed: false };
	}
	const childCount = [...store.tree.byId.values()].filter((each) => each.frontmatter.parent === id).length;
	// Say what will happen to the children BEFORE asking. Re-parenting to the grandparent
	// is the store's rule; the user should not have to discover it by doing it.
	const detail =
		childCount === 0
			? 'This module has no children.'
			: `Its ${childCount} child module(s) will move up to its parent, not be deleted.`;
	const answer = await vscode.window.showWarningMessage(
		`Delete "${node.frontmatter.title}"?`,
		{ modal: true, detail: `${detail}\n\nThe file is removed from .vousoir/spec/.` },
		'Delete',
	);
	if (answer !== 'Delete') {
		return UNCHANGED;
	}
	await store.delete(id);
	return { notice: `Deleted "${node.frontmatter.title}".`, changed: true };
}

async function reparentNode(store: SpecStore, id: string, parent: string | null): Promise<MutationOutcome> {
	if (store.tree.byId.get(id)?.frontmatter.parent === parent) {
		return UNCHANGED;
	}
	// The store owns cycle rejection: dropping a module onto its own descendant throws
	// there, and the message it throws is the one the user sees.
	await store.reparent(id, parent);
	const target = parent === null ? 'the top level' : `"${titleOf(store, parent)}"`;
	return { notice: `Moved "${titleOf(store, id)}" into ${target}.`, changed: true };
}

function titleOf(store: SpecStore, id: string): string {
	return store.tree.byId.get(id)?.frontmatter.title ?? id;
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
