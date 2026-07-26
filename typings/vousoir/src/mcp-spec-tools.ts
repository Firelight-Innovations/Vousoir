/**
 * The nine MCP tool payloads the spec server exposes (ADR-006).
 *
 * Schemas, not interfaces: `vousoir-technical-spec.md:153` — *"All MCP tool inputs/outputs
 * defined as schemas (zod), with types derived from schemas — the schema is the contract"*.
 * The server derives its tool registration from these, so a tool cannot advertise a shape
 * it does not actually accept.
 *
 * Two constraints bind this file, both from ADR-006. `@vousoir/typings` compiles with
 * `"types": []`, so nothing here may reach for `Buffer`, `URL` or any Node/DOM type —
 * primitives and zod only. And `typings-only-imports-zod` means the MCP SDK can never be
 * imported here; only the schemas that describe its payloads live in this package, while
 * the SDK stays in `vousoir/services/spec-mcp/`.
 */

import { z } from 'zod';
import { specNodeContractSchema, specNodeFrontmatterSchema, specNodeStatusSchema, specNodeTestCaseSchema } from './spec-node-frontmatter.ts';
import { workOrderAncestorSchema, workOrderNeighbourContractSchema, workOrderSchema } from './work-order.ts';

/** Server name an external agent registers. Also the `claude mcp add` argument. */
export const MCP_SPEC_SERVER_NAME = 'vousoir-spec' as const;

/** One node in a listing: enough to rebuild the tree without fetching every node. */
export const mcpModuleSummarySchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	parent: z.string().min(1).nullable(),
	status: specNodeStatusSchema,
});
export type McpModuleSummary = z.infer<typeof mcpModuleSummarySchema>;

// ── Read tools ──────────────────────────────────────────────────────────────────────

export const listModulesInputSchema = z.object({});
/**
 * Every record carries `parent`, so the client reconstructs the hierarchy itself — which
 * is why ADR-006 folds `get_tree` into this rather than shipping both.
 */
export const listModulesOutputSchema = z.object({ modules: z.array(mcpModuleSummarySchema) });

export const getModuleInputSchema = z.object({ id: z.string().min(1) });
export const getModuleOutputSchema = z.object({
	frontmatter: specNodeFrontmatterSchema,
	/** The free-form markdown below the frontmatter: the node's behaviour, in prose. */
	body: z.string(),
	/** Absolute path, so an agent can open or diff the file directly. */
	filePath: z.string().min(1),
});

/** A module's boundary, with the deprecated scalar kept distinct from the typed array. */
export const mcpModuleContractsSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	contracts: z.array(specNodeContractSchema),
	/** The deprecated free-form `contract`, present only when no typed contracts exist. */
	legacyContract: z.string().optional(),
});

export const getContractsInputSchema = z.object({
	id: z.string().min(1),
	/** Include the parent, siblings and children as well. Defaults to false. */
	includeNeighbours: z.boolean().optional(),
});
export const getContractsOutputSchema = z.object({
	module: mcpModuleContractsSchema,
	neighbours: z.array(mcpModuleContractsSchema).optional(),
});

export const getNeighborContextInputSchema = z.object({ id: z.string().min(1) });
/** Exactly what the work-order compiler assembles — same shapes, same guarantees. */
export const getNeighborContextOutputSchema = z.object({
	ancestors: z.array(workOrderAncestorSchema),
	neighbours: z.array(workOrderNeighbourContractSchema),
});

export const getWorkOrderInputSchema = z.object({ id: z.string().min(1) });
/**
 * ADR-006 folds `compile_work_order` into this: compilation is deterministic from the
 * files on disk, so a compile-then-get pair would make an agent issue two calls to observe
 * one derived value.
 */
export const getWorkOrderOutputSchema = workOrderSchema;

// ── Write tools ─────────────────────────────────────────────────────────────────────

/** What every write returns, so an agent can confirm the effect without a second read. */
export const mcpWriteResultSchema = z.object({
	module: mcpModuleSummarySchema,
	filePath: z.string().min(1),
});

export const createModuleInputSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	/** `null` creates a root. */
	parent: z.string().min(1).nullable(),
	status: specNodeStatusSchema.optional(),
	/** Initial markdown body: the node's behaviour, in prose. */
	body: z.string().optional(),
});

export const updateModuleInputSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).optional(),
	/**
	 * The deprecated frontmatter field. Prefer `body`, which is the canonical home for
	 * behaviour; this is offered so a file that already uses the field can be edited in
	 * place rather than silently migrated.
	 */
	behaviour: z.string().optional(),
	status: specNodeStatusSchema.optional(),
	body: z.string().optional(),
});

export const updateContractInputSchema = z.object({
	id: z.string().min(1),
	/** Replaces `contracts` wholesale. An empty array clears the typed contracts. */
	contracts: z.array(specNodeContractSchema),
});

export const addTestCaseInputSchema = z.object({
	id: z.string().min(1),
	testCase: specNodeTestCaseSchema,
});

/** Every tool name the server registers, in the order ADR-006 lists them. */
export const MCP_SPEC_TOOL_NAMES = [
	'list_modules',
	'get_module',
	'get_contracts',
	'get_neighbor_context',
	'get_work_order',
	'create_module',
	'update_module',
	'update_contract',
	'add_test_case',
] as const;
export type McpSpecToolName = (typeof MCP_SPEC_TOOL_NAMES)[number];
