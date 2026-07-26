/**
 * The four write tools (ADR-006): `create_module`, `update_module`, `update_contract`,
 * `add_test_case`.
 *
 * Every write goes through the M1 `SpecStore`, never straight to disk. That is what buys
 * the surgical YAML edit — comments and formatting the user wrote by hand survive an agent
 * changing one field — plus id-uniqueness, parent validation and cycle rejection, for free
 * and identically to the editor.
 *
 * Nothing here migrates text between the deprecated `behaviour` frontmatter field and the
 * markdown body. An agent that sets one leaves the other exactly where it was.
 */

import { SpecStore } from '@vousoir/shared';
import type { SpecNode, SpecNodeFrontmatter } from '@vousoir/typings';
import type { z } from 'zod';
import type {
	addTestCaseInputSchema,
	createModuleInputSchema,
	mcpWriteResultSchema,
	updateContractInputSchema,
	updateModuleInputSchema,
} from '@vousoir/typings';
import { withSpecStore } from './spec-session.ts';

type WriteResult = z.infer<typeof mcpWriteResultSchema>;

/** Creates a node under `parent`, writing a new `.md` in the parent's directory. */
export async function createModule(
	repoRoot: string,
	input: z.infer<typeof createModuleInputSchema>,
): Promise<WriteResult> {
	return withSpecStore(repoRoot, async (store) => {
		const created = await store.create({
			id: input.id,
			title: input.title,
			parent: input.parent,
			...(input.status === undefined ? {} : { status: input.status }),
			...(input.body === undefined ? {} : { body: input.body }),
		});
		return toResult(created);
	});
}

/** Replaces any of `title`, `behaviour`, `status` and the markdown body. */
export async function updateModule(
	repoRoot: string,
	input: z.infer<typeof updateModuleInputSchema>,
): Promise<WriteResult> {
	return withSpecStore(repoRoot, async (store) =>
		editNode(store, input.id, (node) => ({
			frontmatter: {
				...node.frontmatter,
				...(input.title === undefined ? {} : { title: input.title }),
				...(input.behaviour === undefined ? {} : { behaviour: input.behaviour }),
				...(input.status === undefined ? {} : { status: input.status }),
			},
			body: input.body ?? node.body,
		})),
	);
}

/**
 * Replaces the node's typed `contracts` wholesale.
 *
 * The deprecated scalar `contract` is left untouched rather than cleared. It is the user's
 * text, this tool was not asked to delete it, and `resolveSpecNodeContracts` already makes
 * `contracts` win whenever it is present — so a stale scalar is inert, not ambiguous.
 */
export async function updateContract(
	repoRoot: string,
	input: z.infer<typeof updateContractInputSchema>,
): Promise<WriteResult> {
	return withSpecStore(repoRoot, async (store) =>
		editNode(store, input.id, (node) => ({
			frontmatter: { ...node.frontmatter, contracts: [...input.contracts] },
			body: node.body,
		})),
	);
}

/**
 * Appends one test case.
 *
 * Append-one rather than replace-all is a genuinely different operation on a structured
 * array (ADR-006), and it is the one an agent reaches for after implementing a case.
 * A duplicate id is refused: silently replacing a case the user wrote would lose it.
 */
export async function addTestCase(
	repoRoot: string,
	input: z.infer<typeof addTestCaseInputSchema>,
): Promise<WriteResult> {
	return withSpecStore(repoRoot, async (store) =>
		editNode(store, input.id, (node) => {
			const existing = node.frontmatter.testCases ?? [];
			if (existing.some((testCase) => testCase.id === input.testCase.id)) {
				throw new Error(
					`Module "${input.id}" already has a test case with id "${input.testCase.id}". ` +
						'Pick a different id, or use update_module to rewrite the node.',
				);
			}
			return {
				frontmatter: { ...node.frontmatter, testCases: [...existing, input.testCase] },
				body: node.body,
			};
		}),
	);
}

/** Applies an edit to one node and saves it through the store. */
async function editNode(
	store: SpecStore,
	id: string,
	edit: (node: SpecNode) => { frontmatter: SpecNodeFrontmatter; body: string },
): Promise<WriteResult> {
	const node = store.tree.byId.get(id);
	if (node === undefined) {
		throw new Error(`There is no spec module with id "${id}". Call list_modules to see what exists.`);
	}
	const { frontmatter, body } = edit(node);
	return toResult(await store.save({ ...node, frontmatter, body }));
}

function toResult(node: SpecNode): WriteResult {
	return {
		module: {
			id: node.id,
			title: node.frontmatter.title,
			parent: node.frontmatter.parent,
			status: node.frontmatter.status,
		},
		filePath: node.filePath,
	};
}
