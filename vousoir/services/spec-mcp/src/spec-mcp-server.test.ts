/**
 * That the server advertises exactly the nine tools ADR-006 specifies, and that the
 * two-writers situation the DoD actually exercises behaves.
 *
 * The server is driven through an in-memory transport pair rather than a subprocess: that
 * exercises the real MCP protocol — initialize, tools/list, tools/call — without the
 * flakiness of spawning and the risk of an orphaned process in a test suite.
 */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpecStore } from '@vousoir/shared';
import { MCP_SPEC_TOOL_NAMES } from '@vousoir/typings';
import type { SpecStoreChange } from '@vousoir/shared';
import { seedMcpTestRepo } from './fixtures/mcp-test-repo.ts';
import { createSpecMcpServer } from './spec-mcp-server.ts';
import { updateModule } from './write-tools.ts';

let repoRoot: string;

beforeEach(async () => {
	({ repoRoot } = await seedMcpTestRepo());
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

/** Connects a real MCP client to the server over a linked in-memory transport pair. */
async function connectClient(): Promise<Client> {
	const server = createSpecMcpServer(repoRoot);
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'spec-mcp-test', version: '0.0.0' });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return client;
}

describe('the MCP surface', () => {
	it('advertises exactly the nine tools ADR-006 specifies', async () => {
		const client = await connectClient();
		try {
			const { tools } = await client.listTools();
			expect(tools.map((tool) => tool.name).sort()).toEqual([...MCP_SPEC_TOOL_NAMES].sort());
		} finally {
			await client.close();
		}
	});

	it('describes every tool, so an agent can choose without guessing', async () => {
		const client = await connectClient();
		try {
			const { tools } = await client.listTools();
			for (const tool of tools) {
				expect(tool.description ?? '').not.toBe('');
				expect(tool.inputSchema).toBeDefined();
			}
		} finally {
			await client.close();
		}
	});

	it('round-trips a real tools/call over the protocol', async () => {
		const client = await connectClient();
		try {
			const result = await client.callTool({ name: 'list_modules', arguments: {} });
			const structured = result.structuredContent as { modules: { id: string }[] } | undefined;
			expect(structured?.modules.map((module) => module.id)).toContain('api');
		} finally {
			await client.close();
		}
	});

	it('reports a bad id as a tool error rather than crashing the server', async () => {
		const client = await connectClient();
		try {
			const result = await client.callTool({ name: 'get_module', arguments: { id: 'ghost' } });
			expect(result.isError).toBe(true);
			// Read the text out rather than stringifying the envelope, which would escape the quotes.
			const text = (result.content as { text?: string }[]).map((block) => block.text ?? '').join('\n');
			expect(text).toContain('no spec module with id "ghost"');
			expect(text).toContain('list_modules');

			// Still serving afterwards — one bad call must not take the session down.
			const after = await client.callTool({ name: 'list_modules', arguments: {} });
			expect(after.isError).toBeFalsy();
		} finally {
			await client.close();
		}
	});
});

describe('two writers on .vousoir/spec/', () => {
	it('the editor watcher sees a write made by the MCP side', async () => {
		// This is the DoD path: an external agent edits the model while the editor is open.
		const store = await SpecStore.open({ repoRoot });
		try {
			const target = join(store.specDir, 'root', 'storage.md');
			const change = new Promise<SpecStoreChange>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error('no change event arrived')), 5000);
				store.watch((event) => {
					clearTimeout(timer);
					resolve(event);
				});
			});

			await updateModule(repoRoot, { id: 'storage', title: 'Renamed by MCP' });

			expect((await change).filePath).toBe(target);
			await store.load();
			expect(store.tree.byId.get('storage')?.frontmatter.title).toBe('Renamed by MCP');
		} finally {
			store.dispose();
		}
	});
});
