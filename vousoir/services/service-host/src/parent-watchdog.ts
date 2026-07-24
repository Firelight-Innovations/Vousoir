/**
 * Orphan-prevention watchdog (PATCHES.md A1/A2 follow-on): if whoever spawned `main.ts`
 * (`vousoir-core`) dies without sending a `shutdown` request — crash, force-quit — this process
 * has no other way to notice, and Windows has no parent-death signal. Every Vousoir process
 * should run this: it polls whether the parent pid handed down via `VOUSOIR_PARENT_PID` is still
 * alive and invokes a callback the moment it is not, so the caller can dispose its own children
 * before exiting. `process.kill(pid, 0)` sends no signal — it is a pure liveness probe, and it
 * works on Windows too.
 *
 * This is the same technique as `@vousoir/dummy-service`'s copy, duplicated rather than shared
 * (services may not import `service-host`, and the reverse isn't worth a shared package for
 * ~20 lines). Unlike `dummy-service`, which can just exit immediately, `service-host` has its
 * own children to terminate first, so this takes a callback instead of calling `process.exit`.
 */

const CHECK_INTERVAL_MS = 1500;

export function watchParentProcess(parentPid: number, onOrphaned: () => void): void {
	const timer = setInterval(() => {
		if (!isProcessAlive(parentPid)) {
			clearInterval(timer);
			onOrphaned();
		}
	}, CHECK_INTERVAL_MS);
	timer.unref();
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
