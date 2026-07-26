/**
 * The per-node spec panel: Behaviour, Contracts, Test cases (M3).
 *
 * Replaces the placeholder "canvas coming soon" view. It lives in the activity bar rather
 * than inside the canvas webview so the two do not compete for space, and so each webview
 * script stays small enough to reason about.
 *
 * **The external-edit conflict, decided deliberately.** The M1 watcher makes an outside
 * change visible, and the risk is reloading over an edit the user has half-typed. The rule
 * here: while the panel is dirty, an external change **warns and does not reload**. The
 * user's unsaved words are the only copy that exists anywhere; the file on disk is already
 * safe in git and can be re-read at any time. Destroying the irreplaceable side to refresh
 * the replaceable one would be the wrong trade. When the panel is clean, an external
 * change reloads silently, because there is nothing to lose.
 *
 * Saving writes exactly one file — the node's own — because it goes through the M1 store's
 * `save`, which touches only that path.
 */

import * as vscode from 'vscode';
import { SpecStore, editSpecNode, resolveSpecNodeBehaviour, specCompleteness, usesFrontmatterBehaviour } from '@vousoir/shared';
import { specPanelInboundMessageSchema, type SpecPanelOutboundMessage } from '@vousoir/typings';
import { specPanelHtml } from './spec-panel-html.ts';
import type { SpecSelection, SpecSelectionState } from './spec-selection.ts';

export const VOUSOIR_VIEW_ID = 'vousoir.panel';

export class SpecPanelProvider implements vscode.WebviewViewProvider {
	readonly #extensionUri: vscode.Uri;
	readonly #selection: SpecSelection;
	readonly #log: vscode.OutputChannel;
	#view: vscode.WebviewView | undefined;
	#dirty = false;

	constructor(extensionUri: vscode.Uri, selection: SpecSelection, log: vscode.OutputChannel) {
		this.#extensionUri = extensionUri;
		this.#selection = selection;
		this.#log = log;
		selection.onDidChange((state) => {
			void this.#show(state);
		});
	}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.#view = view;
		const mediaRoot = vscode.Uri.joinPath(this.#extensionUri, 'media');
		view.webview.options = { enableScripts: true, localResourceRoots: [mediaRoot] };
		view.webview.html = specPanelHtml(view.webview, mediaRoot);
		view.webview.onDidReceiveMessage((raw: unknown) => {
			void this.#onMessage(raw);
		});
	}

	/** Called by the watcher when a spec file changes underneath the panel. */
	async onExternalChange(): Promise<void> {
		const state = this.#selection.current;
		if (state === undefined) {
			return;
		}
		if (this.#dirty) {
			// Warn, do not reload. Unsaved words exist nowhere else; the file does.
			this.#post({
				type: 'externalChange',
				message: 'This module changed on disk while you were editing. Your unsaved edits are kept — save to overwrite, or reopen the node to discard them.',
			});
			return;
		}
		await this.#show(state);
	}

	async #onMessage(raw: unknown): Promise<void> {
		const parsed = specPanelInboundMessageSchema.safeParse(raw);
		if (!parsed.success) {
			this.#log.appendLine(`[vousoir:panel] ignored malformed message: ${JSON.stringify(raw)}`);
			return;
		}
		switch (parsed.data.type) {
			case 'ready':
				await this.#show(this.#selection.current);
				return;
			case 'dirty':
				this.#dirty = parsed.data.dirty;
				return;
			case 'save':
				await this.#save(parsed.data);
				return;
			case 'openFile':
				await this.#openFile(parsed.data.id);
				return;
			case 'error':
				this.#log.appendLine(`[vousoir:panel] webview error: ${parsed.data.message}`);
				return;
		}
	}

	async #save(edit: Extract<ReturnType<typeof specPanelInboundMessageSchema.parse>, { type: 'save' }>): Promise<void> {
		const state = this.#selection.current;
		if (state === undefined) {
			return;
		}
		try {
			const store = await SpecStore.open({ repoRoot: state.repoRoot });
			try {
				const node = store.tree.byId.get(edit.id);
				if (node === undefined) {
					this.#post({ type: 'showError', message: `"${edit.id}" no longer exists on disk.` });
					return;
				}
				// editSpecNode keeps behaviour in whichever home the node already uses; the
				// panel must not turn a frontmatter node into a body node by being opened.
				await store.save(
					editSpecNode(node, {
						title: edit.title,
						behaviour: edit.behaviour,
						contracts: edit.contracts,
						testCases: edit.testCases,
					}),
				);
			} finally {
				store.dispose();
			}
			this.#dirty = false;
			this.#post({ type: 'saved', message: 'Saved.' });
			// Redraw from disk rather than from what was just sent, so any normalisation
			// the store applied is what the user ends up looking at.
			this.#selection.refresh();
		} catch (error) {
			this.#post({ type: 'showError', message: describe(error) });
		}
	}

	async #openFile(id: string): Promise<void> {
		const state = this.#selection.current;
		if (state === undefined) {
			return;
		}
		const store = await SpecStore.open({ repoRoot: state.repoRoot });
		try {
			const filePath = store.tree.byId.get(id)?.filePath;
			if (filePath !== undefined) {
				const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
				await vscode.window.showTextDocument(document, { preview: false });
			}
		} finally {
			store.dispose();
		}
	}

	async #show(state: SpecSelectionState | undefined): Promise<void> {
		if (state === undefined || state.nodeId === null) {
			this.#post({ type: 'showEmpty', message: 'Select a module on the canvas to see its spec.' });
			return;
		}
		try {
			const store = await SpecStore.open({ repoRoot: state.repoRoot });
			try {
				const node = store.tree.byId.get(state.nodeId);
				if (node === undefined) {
					this.#post({ type: 'showEmpty', message: 'That module no longer exists.' });
					return;
				}
				const completeness = specCompleteness(node);
				this.#dirty = false;
				this.#post({
					type: 'showNode',
					node: {
						id: node.id,
						title: node.frontmatter.title,
						status: node.frontmatter.status,
						behaviour: resolveSpecNodeBehaviour(node) ?? '',
						behaviourInFrontmatter: usesFrontmatterBehaviour(node),
						contracts: [...(node.frontmatter.contracts ?? [])],
						testCases: [...(node.frontmatter.testCases ?? [])],
						filePath: node.filePath,
						missing: [...completeness.missing],
						isSpecified: completeness.isSpecified,
					},
				});
			} finally {
				store.dispose();
			}
		} catch (error) {
			this.#post({ type: 'showError', message: describe(error) });
		}
	}

	#post(message: SpecPanelOutboundMessage): void {
		void this.#view?.webview.postMessage(message);
	}
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
