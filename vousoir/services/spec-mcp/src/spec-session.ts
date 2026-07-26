/**
 * Opens the spec store for the duration of one tool call, then closes it.
 *
 * Deliberately no cached tree. Two writers now exist for `.vousoir/spec/` — this server and
 * the editor — and ADR-002's posture is per-file last-write-wins with no lock. A server
 * that held a tree in memory would answer from a snapshot that the editor had already
 * invalidated, and would overwrite the user's edit on its next write. Re-reading per call
 * is the cheap, correct behaviour at this scale.
 *
 * It also never starts the watcher: a request/response tool call has nothing to do with a
 * file-change event, and leaving a recursive `fs.watch` running per call would leak.
 */

import { SpecStore } from '@vousoir/shared';

/** Runs `use` against a freshly loaded store, disposing it whatever happens. */
export async function withSpecStore<T>(repoRoot: string, use: (store: SpecStore) => Promise<T> | T): Promise<T> {
	const store = await SpecStore.open({ repoRoot });
	try {
		return await use(store);
	} finally {
		store.dispose();
	}
}
