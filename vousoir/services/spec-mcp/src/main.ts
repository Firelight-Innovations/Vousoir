/**
 * Process entry: serve the spec over MCP on stdio.
 *
 * Launched by an external agent (`claude mcp add`), never by the extension host — ADR-006.
 * The workbench is not in the path, which is the whole point: an agent in a terminal can
 * read and edit the spec with Vousoir closed, which is what Feature 9 actually asks for.
 *
 * The repo root is argv[2], defaulting to the working directory the client launched us in.
 *
 * **Nothing may be written to stdout except MCP protocol traffic.** stdout is the wire. Any
 * stray `console.log` corrupts the JSON-RPC stream and the client disconnects with a parse
 * error that points nowhere useful — so diagnostics go to stderr, which the client ignores.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PARENT_PID_ENV_VAR } from '@vousoir/typings';
import { watchParentProcess } from './parent-watchdog.ts';
import { createSpecMcpServer } from './spec-mcp-server.ts';

async function main(): Promise<void> {
	const repoRoot = process.argv[2] ?? process.cwd();

	const parentPid = Number(process.env[PARENT_PID_ENV_VAR]);
	if (Number.isInteger(parentPid) && parentPid > 0) {
		watchParentProcess(parentPid);
	}

	const server = createSpecMcpServer(repoRoot);
	await server.connect(new StdioServerTransport());
	process.stderr.write(`[vousoir:spec-mcp] serving ${repoRoot}\n`);
}

main().catch((error: unknown) => {
	process.stderr.write(`[vousoir:spec-mcp] fatal: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
});
