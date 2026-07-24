/**
 * `ServiceHost` — the concrete `ServiceHostHandle` implementation. Owns the full set of
 * `ServiceSupervisor`s spawned for one `start()` call, aggregates their health into
 * `ServiceHostHealth`, and disposes every child on `dispose()` — idempotently, since work order
 * §9.8 requires no orphan processes surviving app exit, and a second `dispose()` call must be
 * harmless.
 */

import type { ServiceHostHandle, ServiceHostHealth, ServiceHostState } from '@vousoir/typings';
import type { ServiceSupervisor } from './service-supervisor.ts';
import { logHost } from './logger.ts';

export class ServiceHost implements ServiceHostHandle {
	private readonly supervisors: readonly ServiceSupervisor[];
	private readonly heartbeatTimer: ReturnType<typeof setInterval>;
	private hostState: ServiceHostState = 'starting';
	private disposePromise: Promise<void> | undefined;

	constructor(supervisors: readonly ServiceSupervisor[], heartbeatIntervalMs: number) {
		this.supervisors = supervisors;
		this.recomputeState();
		this.heartbeatTimer = setInterval(() => this.onHeartbeatTick(), heartbeatIntervalMs);
		this.heartbeatTimer.unref();
	}

	get state(): ServiceHostState {
		return this.hostState;
	}

	private onHeartbeatTick(): void {
		for (const supervisor of this.supervisors) {
			supervisor.checkStaleness();
		}
		this.recomputeState();
		logHost(`heartbeat: ${this.hostState} (${this.supervisors.length} service(s)).`);
	}

	private recomputeState(): void {
		if (this.hostState === 'disposed') {
			return;
		}
		const states = this.supervisors.map((supervisor) => supervisor.getHealth().state);
		if (states.some((state) => state === 'failed' || state === 'unhealthy')) {
			this.hostState = 'unhealthy';
		} else if (states.every((state) => state === 'running')) {
			this.hostState = 'running';
		} else {
			this.hostState = 'starting';
		}
	}

	async health(): Promise<ServiceHostHealth> {
		this.recomputeState();
		return {
			state: this.hostState,
			pid: process.pid,
			services: this.supervisors.map((supervisor) => supervisor.getHealth()),
			checkedAt: new Date().toISOString(),
		};
	}

	async dispose(): Promise<void> {
		this.disposePromise ??= this.doDispose();
		return this.disposePromise;
	}

	private async doDispose(): Promise<void> {
		clearInterval(this.heartbeatTimer);
		await Promise.all(this.supervisors.map((supervisor) => supervisor.terminate()));
		this.hostState = 'disposed';
		logHost('disposed; all supervised services terminated.');
	}
}
