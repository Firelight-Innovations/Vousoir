/**
 * The `vousoir.compileWorkOrder` command: pick a module, compile its work order, open it.
 *
 * This is reachable without the canvas, which is why M4 lands before M2 — the compiler is
 * useful the moment a `.vousoir/spec/` exists, and wiring it to a quick pick costs nothing
 * that the canvas will later have to undo.
 *
 * It compiles, writes and OPENS the result rather than dispatching it. Feature 4 is
 * explicit that this is "the handoff point between designing the system and building the
 * system — a single, deliberate, reviewable action, not something that happens silently".
 * Sending it to an agent is M5's job and needs its own confirmation.
 *
 * All Vousoir-tree imports here are `@vousoir/shared` and `@vousoir/typings`, the only two
 * the boundary wall permits an extension (`ext-imports-only-typings-and-shared`).
 */

import * as vscode from 'vscode';
import { SpecStore, compileWorkOrder, writeWorkOrder } from '@vousoir/shared';
import { toSpecNodePicks } from '../spec-node-quick-pick.ts';

/** Command id. Namespaced `vousoir.*` like every other Vousoir contribution. */
export const COMPILE_WORK_ORDER_COMMAND_ID = 'vousoir.compileWorkOrder';

/** Registers the command. Returns a disposable for `context.subscriptions`. */
export function registerCompileWorkOrderCommand(log: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(COMPILE_WORK_ORDER_COMMAND_ID, async () => {
		try {
			await compileWorkOrderInteractively(log);
		} catch (error) {
			// SpecStoreError already names the offending file; anything else gets its own message.
			const message = error instanceof Error ? error.message : String(error);
			log.appendLine(`[vousoir:work-order] ${message}`);
			void vscode.window.showErrorMessage(`Vousoir: could not compile the work order.\n${message}`);
		}
	});
}

async function compileWorkOrderInteractively(log: vscode.OutputChannel): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (folder === undefined) {
		void vscode.window.showWarningMessage('Vousoir: open a folder first — work orders are compiled from its .vousoir/spec/.');
		return;
	}

	const repoRoot = folder.uri.fsPath;
	const store = await SpecStore.open({ repoRoot });
	try {
		const picks = toSpecNodePicks(store.tree);
		if (picks.length === 0) {
			void vscode.window.showInformationMessage('Vousoir: no spec nodes found under .vousoir/spec/ in this folder.');
			return;
		}

		const chosen = await vscode.window.showQuickPick(picks, {
			title: 'Compile a Vousoir work order',
			placeHolder: 'Pick the module to compile',
			matchOnDescription: true,
			matchOnDetail: true,
		});
		if (chosen === undefined) {
			return;
		}

		const workOrder = compileWorkOrder(store.tree, chosen.nodeId);
		const filePath = await writeWorkOrder(repoRoot, workOrder);
		log.appendLine(`[vousoir:work-order] compiled "${chosen.nodeId}" to ${filePath}`);

		// Opened for review, not dispatched. Preview off: the user is meant to read this.
		const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
		await vscode.window.showTextDocument(document, { preview: false });
	} finally {
		// The store is opened per invocation and watches nothing; disposing keeps it that way.
		store.dispose();
	}
}

