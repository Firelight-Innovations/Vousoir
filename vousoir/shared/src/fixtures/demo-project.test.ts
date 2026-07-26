/**
 * The committed DoD demo fixture.
 *
 * The Definition of Done is a live demo: open `demo.v6r`, see three modules with one
 * nested, full specs, a clean layout, then compile and dispatch. A hand-made demo rots
 * silently — someone renames a field and the demo breaks in front of an audience. These
 * assertions are what make it reproducible.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { v6rManifestSchema } from '@vousoir/typings';
import { parseSpecFile } from '../spec-store/spec-file.ts';
import { findSpecFiles } from '../spec-store/spec-paths.ts';
import { buildSpecTree } from '../spec-store/spec-tree.ts';
import { layoutSpecTree } from '../layout/layout-spec-tree.ts';
import { compileWorkOrder } from '../work-order/compile-work-order.ts';

/** Absolute path of the committed demo project. Read-only. */
export const DEMO_PROJECT_DIR = join(import.meta.dirname, 'demo-project');

async function demoTree() {
	const specDir = join(DEMO_PROJECT_DIR, '.vousoir', 'spec');
	const paths = await findSpecFiles(specDir);
	const files = await Promise.all(paths.map(async (path) => parseSpecFile(path, await readFile(path, 'utf8'))));
	return buildSpecTree(files.map((file) => file.node));
}

describe('the demo project', () => {
	it('has a valid v6r manifest', async () => {
		const raw = await readFile(join(DEMO_PROJECT_DIR, 'demo.v6r'), 'utf8');
		const manifest = v6rManifestSchema.parse(JSON.parse(raw) as unknown);
		expect(manifest.projectName).toBe('Vousoir Demo');
		expect(manifest.specDir).toBe('.vousoir/spec');
	});

	it('is three modules with one nested, under a root', async () => {
		const tree = await demoTree();
		expect(tree.roots.map((root) => root.id)).toEqual(['vousoir-demo']);

		const root = tree.roots[0];
		expect(root?.children.map((child) => child.id)).toEqual(['task-api', 'task-store']);
		const api = root?.children.find((child) => child.id === 'task-api');
		expect(api?.children.map((child) => child.id)).toEqual(['task-validation']);
	});

	it('every module is fully specified — behaviour, contracts and test cases', async () => {
		const tree = await demoTree();
		for (const node of tree.byId.values()) {
			expect(node.body.trim().length).toBeGreaterThan(0);
			if (node.frontmatter.parent === null) {
				continue; // The root owns nothing directly; that is its stated contract.
			}
			expect(node.frontmatter.contracts?.length ?? 0).toBeGreaterThan(0);
			expect(node.frontmatter.testCases?.length ?? 0).toBeGreaterThan(0);
		}
	});

	it('lays out cleanly: every child inside its parent, no sibling overlap', async () => {
		const { boxes } = layoutSpecTree(await demoTree());
		const byId = new Map(boxes.map((box) => [box.id, box]));

		const api = byId.get('task-api');
		const store = byId.get('task-store');
		const validation = byId.get('task-validation');
		const root = byId.get('vousoir-demo');
		expect([root, api, store, validation].every((box) => box !== undefined)).toBe(true);

		// Containment.
		expect(api!.x).toBeGreaterThanOrEqual(root!.x);
		expect(validation!.x).toBeGreaterThanOrEqual(api!.x);
		expect(validation!.x + validation!.width).toBeLessThanOrEqual(api!.x + api!.width);
		// No sibling overlap.
		expect(api!.x + api!.width <= store!.x || store!.x + store!.width <= api!.x).toBe(true);
	});

	it('compiles a work order for the nested module, with its neighbours as contracts only', async () => {
		const tree = await demoTree();
		const { markdown } = compileWorkOrder(tree, 'task-validation');

		expect(markdown).toContain('v6r-node: task-validation');
		expect(markdown).toContain('validateCreateTask');
		// `task-api` is both the ancestor and a neighbour, which is exactly the case worth
		// pinning. As an ancestor it contributes ONE paragraph of orientation; as a
		// neighbour it contributes contracts. Neither route may carry its substance.
		expect(markdown).toContain('GET /tasks');
		expect(markdown).toContain('Serves the task list over HTTP.');
		expect(markdown).not.toContain('Owns no storage of its own');
		expect(markdown).not.toContain('tc-list-empty');
		// The sibling's body and test cases stay out entirely.
		expect(markdown).not.toContain('The only module that touches the database');
		expect(markdown).not.toContain('tc-store-order');
	});
});
