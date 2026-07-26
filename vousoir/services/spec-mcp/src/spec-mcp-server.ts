/**
 * Wires the nine spec tools onto an MCP server (ADR-006).
 *
 * This file is only wiring. Every handler lives in `read-tools.ts` / `write-tools.ts` as a
 * plain async function, so the whole surface is testable without a transport, a client or
 * a subprocess — and so the SDK stays replaceable.
 *
 * Input and output shapes come from `@vousoir/typings`, which is where
 * `vousoir-technical-spec.md:153` puts them: the schema is the contract, and a tool cannot
 * advertise a shape it does not actually accept.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
	MCP_SPEC_SERVER_NAME,
	addTestCaseInputSchema,
	createModuleInputSchema,
	getContractsInputSchema,
	getContractsOutputSchema,
	getModuleInputSchema,
	getModuleOutputSchema,
	getNeighborContextInputSchema,
	getNeighborContextOutputSchema,
	getWorkOrderInputSchema,
	getWorkOrderOutputSchema,
	listModulesInputSchema,
	listModulesOutputSchema,
	mcpWriteResultSchema,
	updateContractInputSchema,
	updateModuleInputSchema,
} from '@vousoir/typings';
import { getContracts, getModule, getNeighborContext, getWorkOrder, listModules } from './read-tools.ts';
import { addTestCase, createModule, updateContract, updateModule } from './write-tools.ts';

const SERVER_VERSION = '0.0.0';

/** A tool result carrying both the readable text and the machine-readable payload. */
function ok(value: unknown): { content: [{ type: 'text'; text: string }]; structuredContent: Record<string, unknown> } {
	return {
		content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
		structuredContent: value as Record<string, unknown>,
	};
}

/** Builds the server for one repo. Connect it to a transport to serve. */
export function createSpecMcpServer(repoRoot: string): McpServer {
	const server = new McpServer({ name: MCP_SPEC_SERVER_NAME, version: SERVER_VERSION });
	registerReadTools(server, repoRoot);
	registerWriteTools(server, repoRoot);
	return server;
}

function registerReadTools(server: McpServer, repoRoot: string): void {
	server.registerTool(
		'list_modules',
		{
			title: 'List modules',
			description:
				'Every module in the spec as { id, title, parent, status }. Each record carries its parent, ' +
				'so the full tree can be reconstructed from one call.',
			inputSchema: listModulesInputSchema.shape,
			outputSchema: listModulesOutputSchema.shape,
		},
		async () => ok(await listModules(repoRoot)),
	);

	server.registerTool(
		'get_module',
		{
			title: 'Get module',
			description: "One module's full spec: frontmatter, the markdown body that holds its behaviour, and its file path.",
			inputSchema: getModuleInputSchema.shape,
			outputSchema: getModuleOutputSchema.shape,
		},
		async (input) => ok(await getModule(repoRoot, input)),
	);

	server.registerTool(
		'get_contracts',
		{
			title: 'Get contracts',
			description:
				"A module's boundary contracts, optionally with those of its parent, siblings and children. " +
				'Contracts are what crosses a module boundary; they never describe how a module works inside.',
			inputSchema: getContractsInputSchema.shape,
			outputSchema: getContractsOutputSchema.shape,
		},
		async (input) => ok(await getContracts(repoRoot, input)),
	);

	server.registerTool(
		'get_neighbor_context',
		{
			title: 'Get neighbour context',
			description:
				'The ancestor chain (one paragraph of orientation each) plus neighbouring contract blocks — ' +
				'what an implementer needs without reading the whole tree.',
			inputSchema: getNeighborContextInputSchema.shape,
			outputSchema: getNeighborContextOutputSchema.shape,
		},
		async (input) => ok(await getNeighborContext(repoRoot, input)),
	);

	server.registerTool(
		'get_work_order',
		{
			title: 'Get work order',
			description:
				'The compiled, self-contained work order for a module: its full spec, ancestor orientation, and ' +
				'neighbouring contracts. Byte-identical to what the Vousoir editor compiles.',
			inputSchema: getWorkOrderInputSchema.shape,
			outputSchema: getWorkOrderOutputSchema.shape,
		},
		async (input) => ok(await getWorkOrder(repoRoot, input)),
	);
}

function registerWriteTools(server: McpServer, repoRoot: string): void {
	server.registerTool(
		'create_module',
		{
			title: 'Create module',
			description: 'Creates a module under a given parent, or a root when parent is null.',
			inputSchema: createModuleInputSchema.shape,
			outputSchema: mcpWriteResultSchema.shape,
		},
		async (input) => ok(await createModule(repoRoot, input)),
	);

	server.registerTool(
		'update_module',
		{
			title: 'Update module',
			description:
				"Replaces any of a module's title, status, deprecated behaviour field, or markdown body. " +
				'Text is never migrated between the behaviour field and the body.',
			inputSchema: updateModuleInputSchema.shape,
			outputSchema: mcpWriteResultSchema.shape,
		},
		async (input) => ok(await updateModule(repoRoot, input)),
	);

	server.registerTool(
		'update_contract',
		{
			title: 'Update contracts',
			description:
				"Replaces a module's typed contracts wholesale. Each contract is { id, kind, name, body } where " +
				'kind is moduleApi, serviceApi or dbSchema.',
			inputSchema: updateContractInputSchema.shape,
			outputSchema: mcpWriteResultSchema.shape,
		},
		async (input) => ok(await updateContract(repoRoot, input)),
	);

	server.registerTool(
		'add_test_case',
		{
			title: 'Add test case',
			description:
				'Appends one test case to a module. Requires id, description and expected; given/when/then and a ' +
				'snippet are optional. Refuses a duplicate test-case id rather than overwriting.',
			inputSchema: addTestCaseInputSchema.shape,
			outputSchema: mcpWriteResultSchema.shape,
		},
		async (input) => ok(await addTestCase(repoRoot, input)),
	);
}
