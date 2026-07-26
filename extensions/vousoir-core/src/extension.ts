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
import { VOUSOIR_VIEW_ID, VousoirViewProvider } from './panel/vousoir-view-provider.ts';
import { startServiceHost } from './service-host/service-host-manager.ts';
import { registerCompileWorkOrderCommand } from './work-order/compile-work-order-command.ts';
import { registerBuildWithClaudeCommand } from './dispatch/build-with-claude-command.ts';

// Module-scoped so `deactivate()` can await disposal directly - the extension host awaits the
// promise `deactivate()` returns, which `context.subscriptions` disposal alone does not guarantee
// (section 9.8: no orphan processes after the app exits).
let serviceHostHandle: ServiceHostHandle | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const log = vscode.window.createOutputChannel('Vousoir');
	context.subscriptions.push(log);

	// Registered before the service host attempts to start: the panel must render even if the
	// host never comes up (work order section 6.1 point 5).
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VOUSOIR_VIEW_ID, new VousoirViewProvider(vscode.version)),
	);

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
