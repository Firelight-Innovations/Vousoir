/**
 * Reads and writes the module tree in `.v6r/spec/` — one markdown file per node, YAML
 * frontmatter plus a free-form body (ADR-002).
 *
 * It lives in `@vousoir/shared` rather than `vousoir/services/` on purpose. The boundary
 * wall lets `extensions/vousoir-*` import `@vousoir/shared` directly
 * (`ext-imports-only-typings-and-shared`), so the canvas consumes this in-process: no
 * spawned child, no stdio protocol, no supervision. A service would have bought isolation
 * the canvas does not need and cost M2 an entire IPC layer.
 *
 * Two semantics worth knowing before you call it:
 *   - **Deleting a node with children re-parents the orphans to the deleted node's
 *     parent.** It never cascades. A cascade loses a subtree to one click and no undo
 *     stack exists yet; a re-parent is visible on the canvas and reversible by hand.
 *   - **Deleting a root is refused.** A root is any node whose `parent` is `null`.
 *
 * Every structural edit reloads from disk afterwards, so in-memory state is never a guess
 * about what the bytes say.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	V6R_ROOT_DIRNAME,
	V6R_SUBDIRS,
	type SpecNode,
	type SpecNodeFrontmatter,
	type SpecNodeStatus,
	type SpecTree,
} from '@vousoir/typings';
import { parseSpecFile, renderSpecFile, type SpecFile } from './spec-file.ts';
import { deleteSpecNodeFiles, moveSpecNodeFiles, writeSpecNodeFile } from './spec-node-files.ts';
import { findSpecFiles, specNodePaths } from './spec-paths.ts';
import { SpecStoreError } from './spec-store-error.ts';
import { SpecStoreWatcher, type SpecStoreChange, type SpecStoreWatcherOptions } from './spec-store-watcher.ts';
import { buildSpecTree } from './spec-tree.ts';
import { specNodeDescendantIds, specNodeIdChain } from './spec-tree-walk.ts';

/** Where the store reads and writes. */
export interface SpecStoreOptions {
	/** Absolute path to the repository root. The store owns `<repoRoot>/.v6r/spec/`. */
	readonly repoRoot: string;
}

/** The fields a brand-new node needs. Everything else is filled in as the user specifies it. */
export interface SpecNodeDraft {
	/** Stable identity, unique across the spec. Also the node's filename — pick it once. */
	readonly id: string;
	readonly title: string;
	/** `null` creates a root. */
	readonly parent: string | null;
	/** Defaults to `unspecified` — a node that has only a title. */
	readonly status?: SpecNodeStatus;
	/** Initial markdown body: the node's behaviour, in prose. */
	readonly body?: string;
}

const EMPTY_TREE: SpecTree = { byId: new Map(), roots: [] };

/** The spec tree on disk, loaded, mutable, and watchable. */
export class SpecStore {
	readonly #specDir: string;
	#files = new Map<string, SpecFile>();
	#tree: SpecTree = EMPTY_TREE;
	#watcher: SpecStoreWatcher | undefined;

	private constructor(specDir: string) {
		this.#specDir = specDir;
	}

	/** Opens `<repoRoot>/.v6r/spec/` and loads it. A missing directory is an empty project. */
	static async open(options: SpecStoreOptions): Promise<SpecStore> {
		const store = new SpecStore(join(options.repoRoot, V6R_ROOT_DIRNAME, V6R_SUBDIRS.spec));
		await store.load();
		return store;
	}

	/** Absolute path of the watched `.v6r/spec/` directory. */
	get specDir(): string {
		return this.#specDir;
	}

	/** The tree as of the last load or edit. */
	get tree(): SpecTree {
		return this.#tree;
	}

	/**
	 * Re-reads every `.md` under `.v6r/spec/`, validates it, and rebuilds the tree from
	 * `parent` pointers. Throws `SpecStoreError` naming the offending file.
	 */
	async load(): Promise<SpecTree> {
		const paths = await findSpecFiles(this.#specDir);
		const files = await Promise.all(paths.map(async (filePath) => parseSpecFile(filePath, await readFile(filePath, 'utf8'))));
		// buildSpecTree runs first: it is what rejects duplicate ids, and indexing by id
		// beforehand would silently drop one of the duplicates instead.
		this.#tree = buildSpecTree(files.map((file) => file.node));
		this.#files = new Map(files.map((file) => [file.node.id, file]));
		return this.#tree;
	}

	/**
	 * Writes one node back to its file. An unchanged node produces byte-identical output.
	 * `parent` cannot be changed this way — that moves files, so it goes through `reparent`.
	 */
	async save(node: SpecNode): Promise<SpecNode> {
		const previous = this.#require(node.id);
		if (node.frontmatter.parent !== previous.node.frontmatter.parent) {
			throw new SpecStoreError('save() cannot change `parent`; call reparent() so the node\'s files move with it.', {
				filePath: previous.node.filePath,
			});
		}
		return this.#writeNode(previous.node.filePath, renderSpecFile(node, previous));
	}

	/** Creates a node and its `.md` file under its parent's directory. */
	async create(draft: SpecNodeDraft): Promise<SpecNode> {
		const existing = this.#tree.byId.get(draft.id);
		if (existing !== undefined) {
			throw new SpecStoreError(`already declares id "${draft.id}"; ids must be unique.`, { filePath: existing.filePath });
		}
		if (draft.parent !== null && !this.#tree.byId.has(draft.parent)) {
			throw new SpecStoreError(`cannot create "${draft.id}": no node with id "${draft.parent}" exists to parent it.`);
		}
		const frontmatter: SpecNodeFrontmatter = {
			id: draft.id,
			title: draft.title,
			parent: draft.parent,
			status: draft.status ?? 'unspecified',
		};
		const paths = specNodePaths(this.#specDir, this.#chainFor(draft.parent, draft.id));
		return this.#writeNode(paths.filePath, renderSpecFile({ frontmatter, body: draft.body ?? '' }));
	}

	/**
	 * Changes a node's `title`. Nothing moves: file paths derive from `id`, so renaming is
	 * a one-line frontmatter edit and produces a one-line diff.
	 */
	async rename(id: string, title: string): Promise<SpecNode> {
		const { node } = this.#require(id);
		return this.save({ ...node, frontmatter: { ...node.frontmatter, title } });
	}

	/**
	 * Deletes a node, re-parenting its children to the node's own parent. Refuses to delete
	 * a root — see the class docblock.
	 */
	async delete(id: string): Promise<void> {
		const { node } = this.#require(id);
		const parentId = node.frontmatter.parent;
		if (parentId === null) {
			throw new SpecStoreError(
				'is a spec root, so deleting it would leave every other node without an ancestor. ' +
					'Re-parent or delete its children first, then delete it as a leaf.',
				{ filePath: node.filePath },
			);
		}
		const childIds = [...this.#tree.byId.values()].filter((each) => each.frontmatter.parent === id).map((each) => each.id);
		for (const childId of childIds) {
			await this.reparent(childId, parentId);
		}
		await deleteSpecNodeFiles(specNodePaths(this.#specDir, specNodeIdChain(this.#tree, id)));
		await this.load();
	}

	/**
	 * Moves a node — and its whole subtree, in one directory rename — under a new parent.
	 * Rejects a cycle: a node may not become a descendant of itself.
	 */
	async reparent(id: string, newParentId: string | null): Promise<SpecNode> {
		const { node } = this.#require(id);
		this.#assertReparentable(id, newParentId);
		if (node.frontmatter.parent === newParentId) {
			return node;
		}
		const from = specNodePaths(this.#specDir, specNodeIdChain(this.#tree, id));
		const to = specNodePaths(this.#specDir, this.#chainFor(newParentId, id));
		await moveSpecNodeFiles(from, to);
		const previous = this.#require(id);
		const text = renderSpecFile({ frontmatter: { ...node.frontmatter, parent: newParentId }, body: node.body }, previous);
		this.#watcher?.markSelfWrite(to.filePath);
		await writeSpecNodeFile(to.filePath, text);
		// Every descendant's path changed with the directory rename, so resync from disk.
		await this.load();
		return this.#require(id).node;
	}

	/**
	 * Reports edits made to `.v6r/spec/` outside this store. Writes the store itself makes
	 * are suppressed. Calling it again replaces the previous listener.
	 */
	watch(onChange: (change: SpecStoreChange) => void, options: SpecStoreWatcherOptions = {}): void {
		this.#watcher?.dispose();
		try {
			this.#watcher = new SpecStoreWatcher(this.#specDir, onChange, options);
		} catch (cause) {
			this.#watcher = undefined;
			throw new SpecStoreError('cannot be watched. Scaffold it with v6rInit() before watching.', {
				filePath: this.#specDir,
				cause,
			});
		}
	}

	/** Stops watching. The loaded tree stays readable. */
	dispose(): void {
		this.#watcher?.dispose();
		this.#watcher = undefined;
	}

	/** Writes `text` to `filePath`, then re-parses it so memory matches the bytes on disk. */
	async #writeNode(filePath: string, text: string): Promise<SpecNode> {
		this.#watcher?.markSelfWrite(filePath);
		await writeSpecNodeFile(filePath, text);
		const file = parseSpecFile(filePath, text);
		this.#files.set(file.node.id, file);
		this.#tree = buildSpecTree([...this.#files.values()].map((each) => each.node));
		return file.node;
	}

	#assertReparentable(id: string, newParentId: string | null): void {
		if (newParentId === id) {
			throw new SpecStoreError(`"${id}" cannot be its own parent.`);
		}
		if (newParentId === null) {
			return;
		}
		if (!this.#tree.byId.has(newParentId)) {
			throw new SpecStoreError(`cannot re-parent "${id}": no node with id "${newParentId}" exists.`);
		}
		if (specNodeDescendantIds(this.#tree, id).has(newParentId)) {
			throw new SpecStoreError(
				`cannot re-parent "${id}" under "${newParentId}": that node is one of its own descendants, ` +
					'and the subtree would be detached from the root.',
			);
		}
	}

	#chainFor(parentId: string | null, id: string): readonly string[] {
		return parentId === null ? [id] : [...specNodeIdChain(this.#tree, parentId), id];
	}

	#require(id: string): SpecFile {
		const file = this.#files.get(id);
		if (file === undefined) {
			throw new SpecStoreError(`there is no spec node with id "${id}".`);
		}
		return file;
	}
}
