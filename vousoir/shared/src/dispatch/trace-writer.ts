/**
 * Appends one agent run to `.vousoir/traces/<runId>.jsonl`.
 *
 * `traces/` is in `V6R_COMMITTED_SUBDIRS` — a trace records what actually happened and is
 * not reproducible, so unlike a work order it earns a place in git.
 *
 * Every event is appended as its own write rather than buffered into a stream. A run that
 * crashes, is killed, or takes down the extension host still leaves every line it got to
 * on disk, which is exactly when a trace is worth having. Writes are chained so `seq`
 * order on disk matches emission order.
 *
 * Each line is validated against `traceEventSchema` BEFORE it is queued, so "one valid
 * JSON object per line" is a guarantee this class enforces rather than a hope.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { V6R_ROOT_DIRNAME, V6R_SUBDIRS, traceEventSchema, type TraceEvent } from '@vousoir/typings';

/** `Omit` that distributes over the union, so the `type` discriminant survives. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A trace event without the fields the writer owns. */
export type TraceEventBody = DistributiveOmit<TraceEvent, 'runId' | 'seq' | 'timestamp'>;

/** Writes one run's JSONL trace. */
export class TraceWriter {
	readonly #filePath: string;
	readonly #runId: string;
	readonly #now: () => Date;
	#seq = 0;
	#queue: Promise<void> = Promise.resolve();

	private constructor(filePath: string, runId: string, now: () => Date) {
		this.#filePath = filePath;
		this.#runId = runId;
		this.#now = now;
	}

	/** Creates `.vousoir/traces/` if needed and returns a writer for `runId`. */
	static async open(repoRoot: string, runId: string, now: () => Date = () => new Date()): Promise<TraceWriter> {
		const directory = join(repoRoot, V6R_ROOT_DIRNAME, V6R_SUBDIRS.traces);
		await mkdir(directory, { recursive: true });
		return new TraceWriter(join(directory, `${runId}.jsonl`), runId, now);
	}

	/** Absolute path of the JSONL file. */
	get filePath(): string {
		return this.#filePath;
	}

	/** Stamps `runId`/`seq`/`timestamp` onto `body`, validates it, and queues the append. */
	append(body: TraceEventBody): Promise<void> {
		// Parsed synchronously so a malformed event throws to the caller rather than
		// poisoning the write queue from inside a `.then`.
		const event = traceEventSchema.parse({
			...body,
			runId: this.#runId,
			seq: this.#seq,
			timestamp: this.#now().toISOString(),
		});
		this.#seq += 1;
		this.#queue = this.#queue.then(async () => appendFile(this.#filePath, `${JSON.stringify(event)}\n`, 'utf8'));
		return this.#queue;
	}

	/** Waits for every queued append to reach disk. */
	async close(): Promise<void> {
		await this.#queue;
	}
}
