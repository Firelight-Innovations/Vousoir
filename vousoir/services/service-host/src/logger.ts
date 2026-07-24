/**
 * Trivial prefixed console logger for service-host's own status/heartbeat output (work order
 * §6.2: "Starts, logs a heartbeat..."). Deliberately not a logging framework — just a
 * consistent prefix so supervisor output is easy to grep for in a shared console.
 *
 * Writes to stderr, not stdout: when running as the process entry (`main.ts`), stdout is
 * reserved for the stdio protocol response stream (PATCHES.md A1) — mixing log lines into it
 * would corrupt the newline-delimited JSON the caller is parsing.
 */

export function logHost(message: string): void {
	console.error(`[vousoir:service-host] ${message}`);
}
