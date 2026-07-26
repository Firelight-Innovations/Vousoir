/**
 * The five read tools (ADR-006): `list_modules`, `get_module`, `get_contracts`,
 * `get_neighbor_context`, `get_work_order`.
 *
 * Every handler is a plain async function over a repo root, so the whole read surface is
 * testable without an MCP transport, a client, or a subprocess. `spec-mcp-server.ts` is
 * only the wiring that exposes them.
 *
 * `get_work_order` calls the SAME `compileWorkOrder` the editor command uses. That is
 * load-bearing rather than convenient: two compilers would drift, and an agent would then
 * be building against a different work order than the one the user reviewed.
 */

import { compileWorkOrder, collectWorkOrderContext, resolveSpecNodeContracts } from '@vousoir/shared';
import type { SpecNode, SpecTree } from '@vousoir/typings';
import type { z } from 'zod';
import type {
	getContractsInputSchema,
	getContractsOutputSchema,
	getModuleInputSchema,
	getModuleOutputSchema,
	getNeighborContextInputSchema,
	getNeighborContextOutputSchema,
	getWorkOrderInputSchema,
	getWorkOrderOutputSchema,
	listModulesOutputSchema,
	mcpModuleContractsSchema,
	mcpModuleSummarySchema,
} from '@vousoir/typings';
import { withSpecStore } from './spec-session.ts';

type Summary = z.infer<typeof mcpModuleSummarySchema>;
type ModuleContracts = z.infer<typeof mcpModuleContractsSchema>;

/** Every node as `{ id, title, parent, status }`; the client rebuilds the tree from `parent`. */
export async function listModules(repoRoot: string): Promise<z.infer<typeof listModulesOutputSchema>> {
	return withSpecStore(repoRoot, (store) => ({
		modules: [...store.tree.byId.values()].map(toSummary).sort((left, right) => left.id.localeCompare(right.id)),
	}));
}

/** One node's full spec: validated frontmatter, the markdown body, and where it lives. */
export async function getModule(
	repoRoot: string,
	input: z.infer<typeof getModuleInputSchema>,
): Promise<z.infer<typeof getModuleOutputSchema>> {
	return withSpecStore(repoRoot, (store) => {
		const node = requireNode(store.tree, input.id);
		return { frontmatter: node.frontmatter, body: node.body, filePath: node.filePath };
	});
}

/** A node's boundary, optionally with its parent, siblings and children. */
export async function getContracts(
	repoRoot: string,
	input: z.infer<typeof getContractsInputSchema>,
): Promise<z.infer<typeof getContractsOutputSchema>> {
	return withSpecStore(repoRoot, (store) => {
		const node = requireNode(store.tree, input.id);
		if (input.includeNeighbours !== true) {
			return { module: toContracts(node) };
		}
		const parentId = node.frontmatter.parent;
		const neighbours = [...store.tree.byId.values()]
			.filter((each) => each.id !== node.id && isNeighbour(each, node.id, parentId))
			.sort((left, right) => left.id.localeCompare(right.id))
			.map(toContracts);
		return { module: toContracts(node), neighbours };
	});
}

/**
 * The ancestor chain plus neighbouring contract blocks — what an implementer needs without
 * reading the whole tree. Same assembly the work-order compiler uses, so the two cannot
 * disagree about what counts as context.
 */
export async function getNeighborContext(
	repoRoot: string,
	input: z.infer<typeof getNeighborContextInputSchema>,
): Promise<z.infer<typeof getNeighborContextOutputSchema>> {
	return withSpecStore(repoRoot, (store) => {
		requireNode(store.tree, input.id);
		const context = collectWorkOrderContext(store.tree, input.id);
		return { ancestors: [...context.ancestors], neighbours: [...context.neighbours] };
	});
}

/** The compiled, self-contained work order — byte-identical to the editor command's output. */
export async function getWorkOrder(
	repoRoot: string,
	input: z.infer<typeof getWorkOrderInputSchema>,
): Promise<z.infer<typeof getWorkOrderOutputSchema>> {
	return withSpecStore(repoRoot, (store) => compileWorkOrder(store.tree, input.id));
}

function isNeighbour(candidate: SpecNode, nodeId: string, parentId: string | null): boolean {
	return (
		(parentId !== null && candidate.id === parentId) ||
		candidate.frontmatter.parent === nodeId ||
		candidate.frontmatter.parent === parentId
	);
}

function toSummary(node: SpecNode): Summary {
	return {
		id: node.id,
		title: node.frontmatter.title,
		parent: node.frontmatter.parent,
		status: node.frontmatter.status,
	};
}

function toContracts(node: SpecNode): ModuleContracts {
	// The ADR-008 precedence rule lives in `resolveSpecNodeContracts`; applying it here
	// rather than re-deriving it is what keeps MCP and the canvas answering the same way.
	const { typed, legacy } = resolveSpecNodeContracts(node.frontmatter);
	return {
		id: node.id,
		title: node.frontmatter.title,
		contracts: [...typed],
		...(legacy === undefined ? {} : { legacyContract: legacy }),
	};
}

/** Throws the same actionable, file-naming error the store would. */
function requireNode(tree: SpecTree, id: string): SpecNode {
	const node = tree.byId.get(id);
	if (node === undefined) {
		throw new Error(`There is no spec module with id "${id}". Call list_modules to see what exists.`);
	}
	return node;
}
