/**
 * Service manifest + service-host lifecycle contracts.
 *
 * This file is the shared seam between work-package B (extensions/vousoir-core, which OWNS the
 * service host's lifecycle) and work-package C (vousoir/services/service-host, which IMPLEMENTS
 * it). Both sides build against these declarations; neither imports the other (work order §7.1).
 *
 * Defined here, in @vousoir/typings, because every cross-package data shape lives here and no
 * package redeclares a shared shape locally (§7.3). zod is the one permitted runtime dependency:
 * the schema *is* the contract.
 *
 * NOTE: @vousoir/typings compiles with `"types": []` — no ambient Node or DOM types. Keep these
 * declarations to primitives, zod, and each other. No `ChildProcess`, no `AbortSignal`.
 */

import { z } from 'zod';

/** Bumped whenever the manifest shape changes incompatibly. */
export const SERVICE_MANIFEST_VERSION = 1 as const;

/**
 * A Vousoir service is a package under `vousoir/services/*` that declares this manifest.
 * Work order §6.2: a service declares a name, an entry point, and (later) an MCP surface.
 * Declaring the MCP field now keeps "add a new service" a paved road without building any
 * MCP functionality this work order (§10 keeps real MCP out of scope).
 */
export const serviceManifestSchema = z.object({
	manifestVersion: z.literal(SERVICE_MANIFEST_VERSION),
	/** Stable machine name, kebab-case. Unique across services. e.g. "dummy-service". */
	name: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'service name must be kebab-case'),
	/** Human-facing label for logs and UI. */
	displayName: z.string().min(1).optional(),
	/** Module path to the service entry point, relative to the service package root. */
	entryPoint: z.string().min(1),
	/** Reserved for a later work order: the service's MCP tool surface. */
	mcp: z
		.object({
			/** Transport the service will expose its MCP server over. */
			transport: z.enum(['stdio', 'socket']),
		})
		.optional(),
});

export type ServiceManifest = z.infer<typeof serviceManifestSchema>;

/** Lifecycle state of a single supervised service. */
export const serviceStateSchema = z.enum(['starting', 'running', 'unhealthy', 'stopped', 'failed']);
export type ServiceState = z.infer<typeof serviceStateSchema>;

/** Health of a single supervised service, as reported by the service host. */
export const serviceHealthSchema = z.object({
	name: z.string().min(1),
	state: serviceStateSchema,
	/** OS process id while running. Absent once stopped. */
	pid: z.number().int().positive().optional(),
	/** ISO-8601 timestamp of the last state transition. */
	since: z.string().min(1),
	/** Failure reason or other human-readable detail. */
	detail: z.string().optional(),
});
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

/** Lifecycle state of the service-host supervisor process itself. */
export const serviceHostStateSchema = z.enum(['starting', 'running', 'unhealthy', 'disposed', 'failed']);
export type ServiceHostState = z.infer<typeof serviceHostStateSchema>;

/** Aggregate health: the supervisor plus every service it supervises. */
export const serviceHostHealthSchema = z.object({
	state: serviceHostStateSchema,
	pid: z.number().int().positive().optional(),
	services: z.array(serviceHealthSchema),
	/** ISO-8601 timestamp this snapshot was taken. */
	checkedAt: z.string().min(1),
});
export type ServiceHostHealth = z.infer<typeof serviceHostHealthSchema>;

/** Options for launching the service host. */
export interface ServiceHostStartOptions {
	/** Absolute path to the directory containing service packages (`vousoir/services`). */
	readonly servicesRoot: string;
	/** Milliseconds to wait for the host to report `running` before treating start as failed. */
	readonly startupTimeoutMs?: number;
	/** Milliseconds between heartbeat/health polls. */
	readonly heartbeatIntervalMs?: number;
}

/**
 * A running service host, as seen by its owner (vousoir-core).
 *
 * Disposal must be idempotent and must terminate every supervised service — acceptance test §9.8
 * requires no orphan processes after the app exits.
 */
export interface ServiceHostHandle {
	/** Last known state without performing a fresh check. */
	readonly state: ServiceHostState;
	/** Perform a health check against the running host. */
	health(): Promise<ServiceHostHealth>;
	/** Terminate the host and every service it supervises. Idempotent. */
	dispose(): Promise<void>;
}

/**
 * Implemented by @vousoir/service-host; consumed by extensions/vousoir-core.
 * The extension calls `start()` on activation and `dispose()` on shutdown.
 */
export interface ServiceHostLauncher {
	start(options: ServiceHostStartOptions): Promise<ServiceHostHandle>;
}
