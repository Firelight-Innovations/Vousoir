/**
 * The service-host stdio protocol.
 *
 * The seam between extensions/vousoir-core (work-package B) and vousoir/services/service-host
 * (work-package C). Per the architectural ruling in `vousoir/PATCHES.md` (A1), the extension
 * SPAWNS service-host as a child process and speaks this protocol to it over stdio — it never
 * imports the service-host package (work order §7.1).
 *
 * Wire format: newline-delimited JSON. One complete JSON object per line, on stdin (requests)
 * and stdout (responses/notifications). stdout carries protocol traffic ONLY; human-readable
 * logging goes to stderr, which the parent forwards.
 *
 * Deliberately minimal — health and shutdown. This is NOT MCP: work order §10 keeps real MCP
 * server functionality out of scope for this work order.
 *
 * NOTE: @vousoir/typings compiles with `"types": []` — no ambient Node or DOM types. Keep these
 * declarations to primitives, zod, and each other.
 */

import { z } from 'zod';

import { serviceHostHealthSchema } from './service-lifecycle.ts';

/** Bumped whenever the protocol changes incompatibly. */
export const SERVICE_HOST_PROTOCOL_VERSION = 1 as const;

/**
 * Request: extension → service-host, one JSON object per line on stdin.
 * `id` correlates a response to its request; the host echoes it back verbatim.
 */
export const serviceHostRequestSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('health'), id: z.string().min(1) }),
	z.object({ type: z.literal('shutdown'), id: z.string().min(1) }),
]);
export type ServiceHostRequest = z.infer<typeof serviceHostRequestSchema>;

/**
 * Response / notification: service-host → extension, one JSON object per line on stdout.
 *
 * `ready` is unsolicited and carries no `id`: the host emits it exactly once, after discovery
 * and initial spawning complete, to signal it is accepting requests. The extension should wait
 * for it (bounded by `startupTimeoutMs`) rather than assuming readiness from process spawn.
 */
export const serviceHostResponseSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('ready'),
		protocolVersion: z.literal(SERVICE_HOST_PROTOCOL_VERSION),
		pid: z.number().int().positive(),
	}),
	z.object({ type: z.literal('health'), id: z.string().min(1), health: serviceHostHealthSchema }),
	z.object({ type: z.literal('shutdown'), id: z.string().min(1), ok: z.literal(true) }),
	z.object({ type: z.literal('error'), id: z.string().min(1).optional(), message: z.string().min(1) }),
]);
export type ServiceHostResponse = z.infer<typeof serviceHostResponseSchema>;

/**
 * Environment variable carrying the parent pid, so a spawned process can watchdog its parent and
 * self-exit if orphaned — the safety net behind acceptance test §9.8 when the parent is hard-killed
 * and never gets to run its graceful disposal path.
 */
export const PARENT_PID_ENV_VAR = 'VOUSOIR_PARENT_PID' as const;

/**
 * Must be set to '1' in the env of every spawned Vousoir process.
 *
 * Inside the VS Code extension host `process.execPath` is the ELECTRON binary, not node — spawning
 * it without this launches a whole Electron instance instead of a Node process. Harmless under
 * plain Node, and inherited by grandchildren through the environment.
 */
export const ELECTRON_RUN_AS_NODE_ENV_VAR = 'ELECTRON_RUN_AS_NODE' as const;
