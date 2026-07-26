/**
 * @vousoir/spec-mcp — public surface.
 *
 * The standalone MCP stdio server over `.vousoir/spec/` (ADR-006). `main.ts` is the process
 * entry an external agent launches; this barrel exposes the server factory and the tool
 * handlers so they can be driven directly — by tests, and by anything that wants the spec
 * surface without a transport in the middle.
 */

export { createSpecMcpServer } from './spec-mcp-server.ts';
export { getContracts, getModule, getNeighborContext, getWorkOrder, listModules } from './read-tools.ts';
export { addTestCase, createModule, updateContract, updateModule } from './write-tools.ts';
export { withSpecStore } from './spec-session.ts';
export { watchParentProcess } from './parent-watchdog.ts';
