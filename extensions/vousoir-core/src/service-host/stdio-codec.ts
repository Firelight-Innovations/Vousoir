/**
 * Thin newline-delimited-JSON codec around the service-host stdio contract defined in
 * `@vousoir/typings` (`serviceHostRequestSchema` / `serviceHostResponseSchema`,
 * `service-host-protocol.ts`). Does not redeclare those shapes - only formats outbound requests
 * and validates+parses inbound lines against the real schema. Every inbound line is checked
 * against `serviceHostResponseSchema`; a line that doesn't parse as JSON, or doesn't match the
 * schema, is dropped rather than trusted.
 */
import { serviceHostResponseSchema, type ServiceHostRequest, type ServiceHostResponse } from '@vousoir/typings';

export function formatRequestLine(request: ServiceHostRequest): string {
	return `${JSON.stringify(request)}\n`;
}

/** Returns undefined for a line that is not valid JSON or does not match the response schema. */
export function parseResponseLine(line: string): ServiceHostResponse | undefined {
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

	const result = serviceHostResponseSchema.safeParse(parsed);
	return result.success ? result.data : undefined;
}
