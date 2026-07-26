/**
 * The `vousoir.buildWithClaudeCode` command: pick a module, compile it, confirm, dispatch.
 *
 * Sibling of `compile-work-order-command.ts` and deliberately shaped like it — same quick
 * pick, because the canvas does not exist yet.
 *
 * It asks before it runs, and the confirmation is not a formality. `--permission-mode
 * acceptEdits` lets the agent write files without prompting, in the user's own workspace,
 * with no per-run worktree isolation until after M6. So the modal names the module, the
 * directory that will be written to, and the fact that edits are accepted automatically.
 * Compiling is the reviewable step (Feature 4); this is the heavier one and earns its own.
 *
 * Run status is reported through the output channel and a cancellable progress
 * notification. Nothing here writes status into a spec file — see `typings` `dispatch.ts`.
 */

import * as vscode from 'vscode';
import { SpecStore, claudeMissingMessage, compileWorkOrder, dispatchWorkOrder, findClaudeCli, writeWorkOrder } from '@vousoir/shared';
import type { DispatchEvent, DispatchRunResult, WorkOrder } from '@vousoir/typings';
import { toSpecNodePicks } from '../spec-node-quick-pick.ts';

/** Command id. Namespaced `vousoir.*` like every other contribution. */
export const BUILD_WITH_CLAUDE_COMMAND_ID = 'vousoir.buildWithClaudeCode';

/** Registers the command. Returns a disposable for `context.subscriptions`. */
export function registerBuildWithClaudeCommand(log: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(BUILD_WITH_CLAUDE_COMMAND_ID, async () => {
		try {
			await buildWithClaude(log);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			log.appendLine(`[vousoir:dispatch] ${message}`);
			void vscode.window.showErrorMessage(`Vousoir: dispatch failed.\n${message}`);
		}
	});
}

async function buildWithClaude(log: vscode.OutputChannel): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (folder === undefined) {
		void vscode.window.showWarningMessage('Vousoir: open a folder first — dispatch runs an agent inside it.');
		return;
	}
	const repoRoot = folder.uri.fsPath;

	// Probed before anything is compiled or written, so a missing CLI costs the user
	// nothing and produces a message naming the fix rather than an ENOENT from a stream.
	if ((await findClaudeCli()) === undefined) {
		log.appendLine(`[vousoir:dispatch] ${claudeMissingMessage()}`);
		void vscode.window.showErrorMessage(claudeMissingMessage());
		return;
	}

	const workOrder = await pickAndCompile(repoRoot);
	if (workOrder === undefined) {
		return;
	}
	const workOrderPath = await writeWorkOrder(repoRoot, workOrder);
	if (!(await confirm(workOrder.nodeId, repoRoot, workOrderPath))) {
		return;
	}
	await runDispatch(repoRoot, workOrder, log);
}

/** Opens the store once, picks a node, compiles it, and always disposes the store. */
async function pickAndCompile(repoRoot: string): Promise<WorkOrder | undefined> {
	const store = await SpecStore.open({ repoRoot });
	try {
		const picks = toSpecNodePicks(store.tree);
		if (picks.length === 0) {
			void vscode.window.showInformationMessage('Vousoir: no spec nodes found under .vousoir/spec/ in this folder.');
			return undefined;
		}
		const chosen = await vscode.window.showQuickPick(picks, {
			title: 'Build a Vousoir module with Claude Code',
			placeHolder: 'Pick the module to build',
			matchOnDescription: true,
			matchOnDetail: true,
		});
		return chosen === undefined ? undefined : compileWorkOrder(store.tree, chosen.nodeId);
	} finally {
		store.dispose();
	}
}

/** The blast-radius warning. Modal, and explicit about what is about to happen. */
async function confirm(nodeId: string, repoRoot: string, workOrderPath: string): Promise<boolean> {
	const answer = await vscode.window.showWarningMessage(
		`Build "${nodeId}" with Claude Code?`,
		{
			modal: true,
			detail:
				`Claude Code will run in ${repoRoot} and may create or modify files there WITHOUT asking, ` +
				'because the work order is dispatched with --permission-mode acceptEdits. Commit or stash anything ' +
				`you would not want changed.\n\nWork order: ${workOrderPath}`,
		},
		'Build',
	);
	return answer === 'Build';
}

async function runDispatch(repoRoot: string, workOrder: WorkOrder, log: vscode.OutputChannel): Promise<void> {
	log.show(true);
	const result = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Vousoir: building ${workOrder.nodeId}`, cancellable: true },
		async (_progress, token): Promise<DispatchRunResult> => {
			const run = await dispatchWorkOrder({ repoRoot, workOrder, onEvent: (event) => report(log, workOrder.nodeId, event) });
			log.appendLine(`[${workOrder.nodeId}] trace: ${run.tracePath}`);
			token.onCancellationRequested(() => {
				run.cancel();
			});
			return run.result;
		},
	);

	if (result.status === 'done') {
		void vscode.window.showInformationMessage(`Vousoir: "${result.nodeId}" built. Trace: ${result.tracePath}`);
		return;
	}
	const what = result.cancelled ? 'was cancelled' : 'failed';
	void vscode.window.showErrorMessage(`Vousoir: "${result.nodeId}" ${what}. ${result.failure ?? ''}`.trim());
}

function report(log: vscode.OutputChannel, nodeId: string, event: DispatchEvent): void {
	if (event.kind === 'output') {
		log.appendLine(`[${nodeId}] ${event.text}`);
		return;
	}
	log.appendLine(`[${nodeId}] status: ${event.status}${event.detail === undefined ? '' : ` — ${event.detail}`}`);
}
