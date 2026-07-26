/**
 * vousoir-core - the only code-oss-facing entry point for Vousoir functionality.
 *
 * Work order section 6.1: activates on startup, registers a placeholder "Vousoir" activity-bar panel
 * rendering a static webview (app version + "canvas coming soon"), and owns the service-host
 * lifecycle (spawn on activation, health-check, dispose on shutdown). All future Vousoir
 * features register through this extension.
 *
 * This extension may import ONLY @vousoir/typings and @vousoir/shared from the Vousoir tree
 * (work order section 7.1) - enforced by dependency-cruiser. Reaching the service host's concrete
 * implementation (@vousoir/service-host, work-package C) goes through the seam in
 * src/service-host/launcher-provider.ts, not through an import here.
 */
import * as vscode from 'vscode';
import type { ServiceHostHandle } from '@vousoir/typings';
import { SpecPanelProvider, VOUSOIR_VIEW_ID } from './panel/spec-panel-provider.ts';
import { SpecSelection } from './panel/spec-selection.ts';
import { startServiceHost } from './service-host/service-host-manager.ts';
import { registerCompileWorkOrderCommand } from './work-order/compile-work-order-command.ts';
import { registerBuildWithClaudeCommand } from './dispatch/build-with-claude-command.ts';
import { registerShowMcpRegistrationCommand } from './mcp/show-mcp-registration-command.ts';
import { registerCanvasEditor } from './canvas/v6r-canvas-provider.ts';

// Module-scoped so `deactivate()` can await disposal directly - the extension host awaits the
// promise `deactivate()` returns, which `context.subscriptions` disposal alone does not guarantee
// (section 9.8: no orphan processes after the app exits).
let serviceHostHandle: ServiceHostHandle | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const log = vscode.window.createOutputChannel('Vousoir');
	context.subscriptions.push(log);

	// Registered before the service host attempts to start: the panel must render even if the
	// host never comes up (work order section 6.1 point 5).
	// The per-node spec panel (M3). The canvas and the panel are separate webviews, so a
	// selection made in one crosses the extension host to reach the other.
	const selection = new SpecSelection();
	context.subscriptions.push(selection);
	const specPanel = new SpecPanelProvider(context.extensionUri, selection, log);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(VOUSOIR_VIEW_ID, specPanel));

	// Registered before the service host too: compiling a work order reads `.vousoir/spec/`
	// directly through @vousoir/shared and needs no running service (M4, ADR-002).
	context.subscriptions.push(registerCompileWorkOrderCommand(log));

	// Dispatch spawns the `claude` CLI directly from the extension host (ADR-005) — no
	// service, so this needs nothing beyond the output channel.
	context.subscriptions.push(registerBuildWithClaudeCommand(log));

	// The MCP server is launched by an external `claude`, not by us (ADR-006) — this only
	// prints the registration line the user pastes into a terminal.
	context.subscriptions.push(registerShowMcpRegistrationCommand(log, context.extensionUri));

	// The canvas custom editor, bound to *.v6r (ADR-001). The manifest is a pointer; the
	// model it points at is the markdown tree under .vousoir/spec/.
	context.subscriptions.push(registerCanvasEditor(context, log, selection, specPanel));

	// Registered before the service host too: compiling a work order reads `.vousoir/spec/`
	// directly through @vousoir/shared and needs no running service (M4, ADR-002).
	context.subscriptions.push(registerCompileWorkOrderCommand(log));

	// Dispatch spawns the `claude` CLI directly from the extension host (ADR-005) — no
	// service, so this needs nothing beyond the output channel.
	context.subscriptions.push(registerBuildWithClaudeCommand(log));

	serviceHostHandle = await startServiceHost(vscode.env.appRoot, log);
	context.subscriptions.push({
		dispose: () => {
			void serviceHostHandle?.dispose();
		},
	});
}

export async function deactivate(): Promise<void> {
	await serviceHostHandle?.dispose();
	serviceHostHandle = undefined;
}
