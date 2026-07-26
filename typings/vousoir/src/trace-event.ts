/**
 * Trace-event schema for `.vousoir/traces/*.jsonl` (work order §8, trace capture decision 5):
 * one JSONL record per line, capturing everything the harness emits during an agent run —
 * messages, thinking, tool calls, results, and per-step diffs.
 *
 * Traces are the committed, portable source of truth (plain JSONL, readable in any editor,
 * diffable in git); a SQLite index in `.vousoir/cache/` is only a derived query cache rebuilt
 * from this JSONL at any time — out of scope for this work order (§10).
 */

import { z } from 'zod';

/**
 * Every trace event shares these fields. `runId` groups every event belonging to one
 * agent run's JSONL file; `seq` is a strictly increasing per-run counter so events replay
 * in order even if two events share a `timestamp`.
 */
const traceEventBaseSchema = z.object({
	runId: z.string().min(1),
	seq: z.number().int().nonnegative(),
	/** ISO-8601 timestamp of when the harness emitted this event. */
	timestamp: z.string().min(1),
});

/** A chat message the harness sent or received. */
export const traceMessageEventSchema = traceEventBaseSchema.extend({
	type: z.literal('message'),
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string(),
});

/** A model "thinking"/reasoning block, captured verbatim. */
export const traceThinkingEventSchema = traceEventBaseSchema.extend({
	type: z.literal('thinking'),
	content: z.string(),
});

/** A tool invocation the harness issued. */
export const traceToolCallEventSchema = traceEventBaseSchema.extend({
	type: z.literal('tool_call'),
	toolCallId: z.string().min(1),
	toolName: z.string().min(1),
	input: z.unknown(),
});

/** The result returned for a prior `tool_call` event, matched by `toolCallId`. */
export const traceToolResultEventSchema = traceEventBaseSchema.extend({
	type: z.literal('tool_result'),
	toolCallId: z.string().min(1),
	output: z.unknown(),
	isError: z.boolean().optional(),
});

/** A per-step file diff produced by a tool call (e.g. an edit or write). */
export const traceDiffEventSchema = traceEventBaseSchema.extend({
	type: z.literal('diff'),
	path: z.string().min(1),
	diff: z.string(),
});

/** A run-lifecycle transition (start/finish/failure), not tied to a single tool call. */
export const traceStatusEventSchema = traceEventBaseSchema.extend({
	type: z.literal('status'),
	status: z.enum(['started', 'completed', 'failed', 'cancelled']),
	detail: z.string().optional(),
});

/**
 * One line of a `.vousoir/traces/*.jsonl` file. Discriminated on `type` so a reader can
 * `JSON.parse` a line and validate it without knowing the event kind up front.
 */
export const traceEventSchema = z.discriminatedUnion('type', [
	traceMessageEventSchema,
	traceThinkingEventSchema,
	traceToolCallEventSchema,
	traceToolResultEventSchema,
	traceDiffEventSchema,
	traceStatusEventSchema,
]);

export type TraceEvent = z.infer<typeof traceEventSchema>;
