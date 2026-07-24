/**
 * Wire format for the stdio heartbeat ping — the "trivial health endpoint (local socket or
 * stdio ping)" work order §6.2 asks for. A supervised service writes one JSON line to stdout
 * per tick; `service-host` reads its child's stdout line-by-line (see `service-supervisor.ts`)
 * and treats a matching line as proof of liveness.
 *
 * This format is intentionally duplicated on the producing side (`dummy-service`, and any real
 * service that follows it) rather than imported: services may not import `service-host`
 * (work order §7.1), and the shape is three fields, not worth a shared package for now.
 */

export const HEARTBEAT_TYPE = 'vousoirHeartbeat' as const;

export interface HeartbeatLine {
	readonly vousoirHeartbeat: true;
	readonly ts: string;
}

/** Parses a single line of child stdout; returns undefined if it is not a heartbeat line. */
export function parseHeartbeatLine(line: string): HeartbeatLine | undefined {
	const trimmed = line.trim();
	if (!trimmed) {
		return undefined;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return undefined;
	}

	if (!isHeartbeatShape(parsed)) {
		return undefined;
	}
	return parsed;
}

function isHeartbeatShape(value: unknown): value is HeartbeatLine {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return record[HEARTBEAT_TYPE] === true && typeof record['ts'] === 'string';
}
