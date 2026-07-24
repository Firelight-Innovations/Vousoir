/**
 * Orphan-prevention watchdog (work order §6.2, Windows note: "a killed parent must not leave
 * detached children"). `service-host` explicitly terminates every child on `dispose()`, but if
 * the host process itself dies without running that path (crash, force-quit, Task Manager kill)
 * a spawned child has no other way to notice — Windows has no parent-death signal, and job
 * objects are out of reach without a new native dependency.
 *
 * Every Vousoir service should start this watchdog: it polls whether the parent pid handed down
 * via `VOUSOIR_PARENT_PID` is still alive and self-exits the moment it is not.
 * `process.kill(pid, 0)` sends no signal — it is a pure liveness probe, and it works on Windows
 * too (Node implements it there via a process handle check, not a POSIX signal).
 *
 * `dummy-service` cannot import `@vousoir/service-host` (work order §7.1), so this ~20-line
 * helper is meant to be copied into each new service rather than shared.
 */

const CHECK_INTERVAL_MS = 1500;

export function watchParentProcess(parentPid: number): void {
	const timer = setInterval(() => {
		if (!isProcessAlive(parentPid)) {
			clearInterval(timer);
			process.exit(0);
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
