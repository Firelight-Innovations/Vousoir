/**
 * The canvas: a custom editor bound to `*.v6r` (ADR-001).
 *
 * `CustomTextEditorProvider` rather than the full `CustomEditorProvider`, because the
 * manifest genuinely IS a text document — a small JSON file the user may also open in the
 * normal editor. The editor framework then owns dirty state, save and revert for it, and
 * the canvas does not have to reimplement any of that. The MODEL is not in this document;
 * it is the markdown tree under `.vousoir/spec/`, which the canvas reads and writes
 * through the M1 store.
 *
 * Everything testable lives elsewhere on purpose: layout is a pure function in
 * `@vousoir/shared`, message shapes are zod schemas in `@vousoir/typings`. What is left
 * here is what genuinely needs `vscode`.
 */

import * as vscode from 'vscode';
import { SpecStore, layoutSpecTree, loadLayout, saveLayout, subtreeOf, withPosition, clearedLayout } from '@vousoir/shared';
import {
	V6R_MANIFEST_VERSION,
	canvasInboundMessageSchema,
	v6rManifestSchema,
	type CanvasOutboundMessage,
	type V6rLayoutFile,
} from '@vousoir/typings';
import { canvasHtml } from './canvas-html.ts';
import { applyCanvasMutation } from './canvas-mutations.ts';
import type { SpecPanelProvider } from '../panel/spec-panel-provider.ts';
import type { SpecSelection } from '../panel/spec-selection.ts';

/** The `viewType` the manifest contributes and `registerCustomEditorProvider` binds. */
export const CANVAS_VIEW_TYPE = 'vousoir.canvas';

/** Registers the canvas editor. Returns a disposable for `context.subscriptions`. */
export function registerCanvasEditor(
	context: vscode.ExtensionContext,
	log: vscode.OutputChannel,
	selection: SpecSelection,
	panel: SpecPanelProvider,
): vscode.Disposable {
	return vscode.window.registerCustomEditorProvider(CANVAS_VIEW_TYPE, new V6rCanvasProvider(context, log, selection, panel), {
		webviewOptions: { retainContextWhenHidden: true },
		supportsMultipleEditorsPerDocument: false,
	});
}

class V6rCanvasProvider implements vscode.CustomTextEditorProvider {
	readonly #context: vscode.ExtensionContext;
	readonly #log: vscode.OutputChannel;
	readonly #selection: SpecSelection;
	readonly #panel: SpecPanelProvider;
	/** Drill-in target: render only this subtree. `undefined` shows the whole tree. */
	#focusId: string | null = null;

	constructor(
		context: vscode.ExtensionContext,
		log: vscode.OutputChannel,
		selection: SpecSelection,
		panel: SpecPanelProvider,
	) {
		this.#context = context;
		this.#log = log;
		this.#selection = selection;
		this.#panel = panel;
	}

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		panel: vscode.WebviewPanel,
		token: vscode.CancellationToken,
	): Promise<void> {
		const mediaRoot = vscode.Uri.joinPath(this.#context.extensionUri, 'media');
		panel.webview.options = { enableScripts: true, localResourceRoots: [mediaRoot] };

		const repoRoot = repoRootFor(document.uri);
		const projectName = this.#readProjectName(document);
		panel.webview.html = canvasHtml(panel.webview, mediaRoot, projectName);

		let layout = await loadLayout(repoRoot);
		const draw = async (): Promise<void> => {
			layout = await this.#render(panel, repoRoot, projectName, layout);
		};

		panel.webview.onDidReceiveMessage((raw: unknown) => {
			void this.#onMessage(raw, panel, repoRoot, layout, draw).then((next) => {
				if (next !== undefined) {
					layout = next;
				}
			});
		});

		// Re-render when the spec changes underneath us — another editor, the MCP server,
		// or an agent mid-dispatch. Feature 10 promises the canvas is not a cage.
		const store = await SpecStore.open({ repoRoot });
		try {
			store.watch(() => {
				void draw();
				// The panel decides for itself whether to reload: while the user is mid-edit
				// it warns instead, because unsaved words exist nowhere else.
				void this.#panel.onExternalChange();
			});
		} catch (error) {
			// A project without a scaffolded `.vousoir/spec/` still opens; it just cannot watch.
			this.#log.appendLine(`[vousoir:canvas] not watching: ${describe(error)}`);
		}
		panel.onDidDispose(() => {
			store.dispose();
		});
		if (token.isCancellationRequested) {
			return;
		}
	}

	/** Handles one inbound message. Returns a new layout when it changed. */
	async #onMessage(
		raw: unknown,
		panel: vscode.WebviewPanel,
		repoRoot: string,
		layout: V6rLayoutFile,
		draw: () => Promise<void>,
	): Promise<V6rLayoutFile | undefined> {
		const parsed = canvasInboundMessageSchema.safeParse(raw);
		if (!parsed.success) {
			// Logged with the payload rather than dropped: a silently ignored message is
			// the exact failure the typed protocol exists to prevent.
			this.#log.appendLine(`[vousoir:canvas] ignored malformed message: ${JSON.stringify(raw)}`);
			return undefined;
		}
		switch (parsed.data.type) {
			case 'ready':
				await draw();
				return undefined;
			case 'moveNode': {
				const next = withPosition(layout, parsed.data.id, parsed.data.position);
				await saveLayout(repoRoot, next);
				return next;
			}
			case 'tidy': {
				// Auto-tidy is this, and only this: discard the user's placements so
				// auto-layout applies again. It never happens as a side effect of an edit.
				const next = clearedLayout();
				await saveLayout(repoRoot, next);
				await draw();
				return next;
			}
			case 'drillInto':
				this.#focusId = parsed.data.id;
				await draw();
				return undefined;
			case 'createNode':
			case 'renameNode':
			case 'deleteNode':
			case 'reparentNode': {
				const outcome = await applyCanvasMutation(repoRoot, parsed.data);
				if (outcome.notice !== undefined) {
					post(panel, { type: 'notice', message: outcome.notice });
				}
				if (outcome.changed) {
					await draw();
				}
				return undefined;
			}
			case 'selectNode':
				this.#selection.set({ repoRoot, nodeId: parsed.data.id });
				return undefined;
			case 'error':
				this.#log.appendLine(`[vousoir:canvas] webview error: ${parsed.data.message}`);
				return undefined;
		}
	}

	/** Loads the tree, lays it out, and posts one full render. */
	async #render(
		panel: vscode.WebviewPanel,
		repoRoot: string,
		projectName: string,
		layout: V6rLayoutFile,
	): Promise<V6rLayoutFile> {
		try {
			const store = await SpecStore.open({ repoRoot });
			try {
				const current = await loadLayout(repoRoot);
				// Drilling in is a VIEW: the subtree is re-rooted for layout only, and the
				// node on disk keeps its real parent.
				const focused = this.#focusId === null ? store.tree : subtreeOf(store.tree, this.#focusId);
				const canvas = layoutSpecTree(focused, { positions: current.positions });
				const focusTitle = this.#focusId === null ? undefined : store.tree.byId.get(this.#focusId)?.frontmatter.title;
				post(panel, {
					type: 'render',
					projectName: focusTitle === undefined ? projectName : `${projectName} / ${focusTitle}`,
					width: canvas.width,
					height: canvas.height,
					boxes: canvas.boxes.map((box) => ({ ...box })),
				});
				return current;
			} finally {
				store.dispose();
			}
		} catch (error) {
			this.#log.appendLine(`[vousoir:canvas] ${describe(error)}`);
			post(panel, { type: 'showError', message: describe(error) });
			return layout;
		}
	}

	/** A malformed manifest names the file and falls back — it must not block opening. */
	#readProjectName(document: vscode.TextDocument): string {
		const text = document.getText().trim();
		if (text.length === 0) {
			return 'Vousoir';
		}
		try {
			const parsed = v6rManifestSchema.safeParse(JSON.parse(text) as unknown);
			if (parsed.success) {
				return parsed.data.projectName;
			}
			this.#log.appendLine(
				`[vousoir:canvas] ${document.uri.fsPath} is not a valid v${V6R_MANIFEST_VERSION} manifest; opening anyway.`,
			);
		} catch (error) {
			this.#log.appendLine(`[vousoir:canvas] ${document.uri.fsPath} is not valid JSON: ${describe(error)}`);
		}
		return 'Vousoir';
	}
}

function post(panel: vscode.WebviewPanel, message: CanvasOutboundMessage): void {
	void panel.webview.postMessage(message);
}

/** The repo root is the workspace folder holding the manifest, else its own directory. */
function repoRootFor(manifest: vscode.Uri): string {
	return vscode.workspace.getWorkspaceFolder(manifest)?.uri.fsPath ?? vscode.Uri.joinPath(manifest, '..').fsPath;
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
