/**
 * @vousoir/service-host — public surface.
 *
 * A small supervisor that spawns, monitors, and disposes Vousoir services declared through the
 * service manifest format (work order §6.2).
 *
 * IMPORTANT (PATCHES.md A1): `vousoir-core` does NOT import this package. It spawns
 * `src/main.ts` as a child process and speaks the stdio protocol defined in
 * `@vousoir/typings`'s `service-host-protocol.ts` — the extension may only import
 * `@vousoir/typings` and `@vousoir/shared` (work order §7.1), and `dependency-cruiser` enforces
 * that mechanically. `serviceHostLauncher` below is exported for this package's own tests
 * (which drive the library in-process); it is not a cross-package API.
 *
 * Boundary rule (work order §7.1): service-host is the ONLY package permitted to import
 * service manifests; services never import one another.
 *
 * `exports` seals this package to this barrel — internal modules (`service-supervisor.ts` etc.)
 * are not importable from outside, and nothing outside this package may import it anyway.
 */

export { serviceHostLauncher } from './service-host-launcher.ts';
export { MANIFEST_FILENAME } from './manifest-discovery.ts';

export const SERVICE_HOST_PACKAGE = 'vousoir-service-host' as const;
