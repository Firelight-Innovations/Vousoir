/**
 * Maps one line of `claude --output-format stream-json` onto the existing trace-event
 * schema.
 *
 * The schema in `@vousoir/typings` predates this milestone and already models messages,
 * thinking, tool calls, tool results and diffs — so this translates rather than invents.
 *
 * Lossless by construction: a line that is not JSON, or is JSON in a shape this does not
 * recognise, becomes a `message` event with `role: 'system'` carrying the raw text. A
 * trace that silently drops what it did not understand is worse than a noisy one, because
 * the gap is invisible when someone later asks what the agent actually did.
 */

import type { TraceEventBody } from './trace-writer.ts';

/** Translates one stream-json line. Never throws; never returns an empty array. */
export function mapClaudeStreamLine(line: string): readonly TraceEventBody[] {
	const trimmed = line.trim();
	if (trimmed.length === 0) {
		return [];
	}
	const parsed = tryParse(trimmed);
	if (parsed === undefined) {
		return [systemNote(trimmed)];
	}
	const events = mapKnown(parsed, trimmed);
	return events.length > 0 ? events : [systemNote(trimmed)];
}

function mapKnown(parsed: Record<string, unknown>, raw: string): readonly TraceEventBody[] {
	const type = asString(parsed['type']);
	if (type === 'assistant' || type === 'user') {
		return contentBlocks(parsed['message']).flatMap((block) => mapBlock(block, type));
	}
	if (type === 'result') {
		// The engine emits the terminal status event from the child's exit code, which is
		// authoritative. Keeping the raw result line preserves timings and token counts.
		return [systemNote(raw)];
	}
	return [];
}

function mapBlock(block: Record<string, unknown>, source: 'assistant' | 'user'): readonly TraceEventBody[] {
	switch (asString(block['type'])) {
		case 'text': {
			const text = asString(block['text']);
			return text === undefined ? [] : [{ type: 'message', role: source, content: text }];
		}
		case 'thinking': {
			const thinking = asString(block['thinking']);
			return thinking === undefined ? [] : [{ type: 'thinking', content: thinking }];
		}
		case 'tool_use': {
			const id = asString(block['id']);
			const name = asString(block['name']);
			return id === undefined || name === undefined
				? []
				: [{ type: 'tool_call', toolCallId: id, toolName: name, input: block['input'] }];
		}
		case 'tool_result': {
			const id = asString(block['tool_use_id']);
			if (id === undefined) {
				return [];
			}
			const isError = block['is_error'];
			return [
				{
					type: 'tool_result',
					toolCallId: id,
					output: block['content'],
					...(typeof isError === 'boolean' ? { isError } : {}),
				},
			];
		}
		default:
			return [];
	}
}

function contentBlocks(message: unknown): readonly Record<string, unknown>[] {
	if (!isRecord(message)) {
		return [];
	}
	const content = message['content'];
	if (!Array.isArray(content)) {
		return [];
	}
	return content.filter(isRecord);
}

function systemNote(raw: string): TraceEventBody {
	return { type: 'message', role: 'system', content: raw };
}

function tryParse(text: string): Record<string, unknown> | undefined {
	try {
		const value: unknown = JSON.parse(text);
		return isRecord(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}
