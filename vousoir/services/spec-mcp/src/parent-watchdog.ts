/**
 * Orphan-prevention watchdog, copied per service by convention (see `dummy-service`'s copy
 * — it says explicitly that a service cannot import another service's helper, so this
 * ~20-line file is meant to be duplicated rather than shared).
 *
 * **For this server it is the secondary mechanism, not the primary one.** An MCP stdio
 * server is spawned by an external `claude`, which knows nothing about Vousoir and does not
 * set `VOUSOIR_PARENT_PID`. The real orphan protection is stdin: when the client goes away
 * the pipe closes and `main.ts` exits. The watchdog engages only when a parent pid is
 * explicitly handed down, which is the case if something in the Vousoir layer ever spawns
 * this server itself.
 */

const CHECK_INTERVAL_MS = 1500;

/** Polls parent liveness and self-exits when it is gone. `process.kill(pid, 0)` sends no signal. */
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
