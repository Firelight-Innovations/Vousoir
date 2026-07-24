/**
 * The `vousoir.showMcpRegistration` command: prints the `claude mcp add` line the user
 * pastes into a terminal to give an external agent access to this project's spec.
 *
 * It prints rather than runs. Registering an MCP server edits the user's own `claude`
 * configuration, outside the workspace, and doing that silently from an editor command is
 * the kind of thing a user should see coming. Copying a visible line is also what makes it
 * reproducible on another machine.
 *
 * The server is NOT spawned by the extension (ADR-006). `claude` launches it, which is what
 * lets it serve with Vousoir closed.
 */

import * as vscode from 'vscode';
import { MCP_SPEC_SERVER_NAME } from '@vousoir/typings';

/** Command id. Namespaced `vousoir.*` like every other contribution. */
export const SHOW_MCP_REGISTRATION_COMMAND_ID = 'vousoir.showMcpRegistration';

/**
 * Path of the server entry, relative to the repo root.
 *
 * A raw `.ts` entry run through Node's type stripping, matching how every other Vousoir
 * service starts (`service-host`'s own `start` script is `node src/main.ts`). It needs
 * Node 24+, which `vousoir/package.json` already requires.
 */
const SERVER_ENTRY = 'vousoir/services/spec-mcp/src/main.ts';

/** Builds the exact shell line to register this workspace's spec server. */
export function mcpRegistrationCommand(repoRoot: string, forkRoot: string): string {
	return `claude mcp add ${MCP_SPEC_SERVER_NAME} -- node "${forkRoot}/${SERVER_ENTRY}" "${repoRoot}"`;
}

/** Registers the command. Returns a disposable for `context.subscriptions`. */
export function registerShowMcpRegistrationCommand(
	log: vscode.OutputChannel,
	extensionUri: vscode.Uri,
): vscode.Disposable {
	return vscode.commands.registerCommand(SHOW_MCP_REGISTRATION_COMMAND_ID, async () => {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (folder === undefined) {
			void vscode.window.showWarningMessage('Vousoir: open a folder first — the MCP server serves one project.');
			return;
		}
		// extensionUri is <fork>/extensions/vousoir-core; the services live two levels up.
		const forkRoot = vscode.Uri.joinPath(extensionUri, '..', '..').fsPath.replace(/\\/g, '/');
		const line = mcpRegistrationCommand(folder.uri.fsPath.replace(/\\/g, '/'), forkRoot);

		log.appendLine('[vousoir:mcp] register this project with an external agent by running:');
		log.appendLine(`[vousoir:mcp]   ${line}`);
		log.show(true);

		const choice = await vscode.window.showInformationMessage(
			'Vousoir: copy this line into a terminal to let an external Claude Code read and edit the spec for this project.',
			{ modal: true, detail: line },
			'Copy',
		);
		if (choice === 'Copy') {
			await vscode.env.clipboard.writeText(line);
			void vscode.window.showInformationMessage('Vousoir: `claude mcp add` line copied to the clipboard.');
		}
	});
}
