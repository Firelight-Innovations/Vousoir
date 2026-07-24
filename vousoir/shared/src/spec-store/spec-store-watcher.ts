/**
 * Watches `.v6r/spec/` for edits made outside Vousoir.
 *
 * This is a product requirement, not a convenience: Portable Spec Files promises the user
 * can edit a spec in their own editor and "the canvas is a convenience, not a cage"
 * (source-of-truth Feature 10). The canvas has to notice.
 *
 * Two behaviours make it usable rather than noisy:
 *   - Writes the store itself just made are suppressed. Without that, every save echoes
 *     back as an external change and M3's spec panel reloads over the user's own edit.
 *   - Bursts are coalesced. One logical save fires several `fs.watch` events on Windows.
 */

import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { SPEC_FILE_EXTENSION } from './spec-paths.ts';

/** One external edit under `.v6r/spec/`. */
export interface SpecStoreChange {
	/**
	 * Absolute path of the file that changed, or `undefined` when the platform reported an
	 * event without a filename. Either way the correct response is to reload the store:
	 * `fs.watch` cannot reliably distinguish create from delete from rename.
	 */
	readonly filePath: string | undefined;
}

/** Tuning for `SpecStoreWatcher`; the defaults suit an interactive editor. */
export interface SpecStoreWatcherOptions {
	/** How long to coalesce a burst of filesystem events. */
	readonly debounceMs?: number;
	/** How long after our own write to keep ignoring events for that path. */
	readonly selfWriteWindowMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 25;
const DEFAULT_SELF_WRITE_WINDOW_MS = 250;

/** A recursive watch over one spec directory. Dispose it to stop watching. */
export class SpecStoreWatcher {
	readonly #specDir: string;
	readonly #onChange: (change: SpecStoreChange) => void;
	readonly #debounceMs: number;
	readonly #selfWriteWindowMs: number;
	readonly #selfWrites = new Map<string, number>();
	readonly #pending = new Set<string | undefined>();
	#watcher: FSWatcher | undefined;
	#timer: NodeJS.Timeout | undefined;

	constructor(specDir: string, onChange: (change: SpecStoreChange) => void, options: SpecStoreWatcherOptions = {}) {
		this.#specDir = specDir;
		this.#onChange = onChange;
		this.#debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
		this.#selfWriteWindowMs = options.selfWriteWindowMs ?? DEFAULT_SELF_WRITE_WINDOW_MS;
		this.#watcher = watch(this.#specDir, { recursive: true }, (_event, filename) => {
			this.#enqueue(filename === null ? undefined : join(this.#specDir, filename.toString()));
		});
	}

	/**
	 * Records that the store is about to write `filePath`, so the resulting event is not
	 * reported back as an external edit. A genuine external write landing on the same path
	 * inside the window is lost — an accepted race at this scale (ADR-002: plain files,
	 * last write wins, no lock).
	 */
	markSelfWrite(filePath: string): void {
		this.#selfWrites.set(filePath, Date.now());
	}

	dispose(): void {
		this.#watcher?.close();
		this.#watcher = undefined;
		if (this.#timer !== undefined) {
			clearTimeout(this.#timer);
			this.#timer = undefined;
		}
		this.#pending.clear();
	}

	#enqueue(filePath: string | undefined): void {
		if (filePath !== undefined) {
			if (!filePath.endsWith(SPEC_FILE_EXTENSION) || this.#isSelfWrite(filePath)) {
				return;
			}
		}
		this.#pending.add(filePath);
		if (this.#timer === undefined) {
			this.#timer = setTimeout(() => {
				this.#flush();
			}, this.#debounceMs);
			this.#timer.unref?.();
		}
	}

	#isSelfWrite(filePath: string): boolean {
		const writtenAt = this.#selfWrites.get(filePath);
		if (writtenAt === undefined) {
			return false;
		}
		if (Date.now() - writtenAt > this.#selfWriteWindowMs) {
			this.#selfWrites.delete(filePath);
			return false;
		}
		return true;
	}

	#flush(): void {
		this.#timer = undefined;
		const changes = [...this.#pending];
		this.#pending.clear();
		for (const filePath of changes) {
			this.#onChange({ filePath });
		}
	}
}
