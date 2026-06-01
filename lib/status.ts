import type { EventRow } from "./types";

// Health derived purely from the run lifecycle an agent emits:
//   run_start  -> a run began
//   run_end    -> it finished cleanly   (payload may carry { ms, ok })
//   run_error  -> it threw              (payload may carry { ms, error })
//
// "stuck" is the silent-failure signal that works even before agents emit
// explicit errors: a run_start with no terminal event after it for a while
// means the agent crashed mid-run (the process died before run_end could fire).
export type AgentState = "ok" | "error" | "stuck" | "idle";

export type AgentStatus = {
  state: AgentState;
  lastError: string | null;
  lastDurationMs: number | null;
  runs: number;
  errors: number;
};

const STUCK_AFTER_MS = 5 * 60 * 1000;

function readNum(payload: unknown, key: string): number | null {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function readStr(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export function computeStatus(
  agentId: string,
  events: EventRow[],
  now: number,
): AgentStatus {
  let lastStartMs: number | null = null;
  let lastTerminalMs: number | null = null;
  let lastTerminalType: "run_end" | "run_error" | null = null;
  let lastError: string | null = null;
  let lastDurationMs: number | null = null;
  let runs = 0;
  let errors = 0;

  // events arrive oldest-first; a single forward pass keeps "last" accurate.
  for (const e of events) {
    if (e.fromId !== agentId) continue;
    const t = new Date(e.createdAt).getTime();
    if (e.type === "run_start") {
      lastStartMs = t;
      runs += 1;
    } else if (e.type === "run_end") {
      lastTerminalMs = t;
      lastTerminalType = "run_end";
      lastDurationMs = readNum(e.payload, "ms") ?? lastDurationMs;
    } else if (e.type === "run_error") {
      lastTerminalMs = t;
      lastTerminalType = "run_error";
      lastError = readStr(e.payload, "error") ?? lastError;
      lastDurationMs = readNum(e.payload, "ms") ?? lastDurationMs;
      errors += 1;
    }
  }

  let state: AgentState;
  const startedAfterTerminal =
    lastStartMs !== null &&
    (lastTerminalMs === null || lastStartMs > lastTerminalMs);

  if (startedAfterTerminal && now - (lastStartMs as number) > STUCK_AFTER_MS) {
    state = "stuck";
  } else if (startedAfterTerminal) {
    state = "ok"; // currently running, within the grace window
  } else if (lastTerminalType === "run_error") {
    state = "error";
  } else if (lastTerminalType === "run_end") {
    state = "ok";
  } else {
    state = "idle"; // only seed/edge events seen — no run lifecycle yet
  }

  return { state, lastError, lastDurationMs, runs, errors };
}

export function computeAllStatuses(
  agentIds: string[],
  events: EventRow[],
  now: number,
): Map<string, AgentStatus> {
  const map = new Map<string, AgentStatus>();
  for (const id of agentIds) map.set(id, computeStatus(id, events, now));
  return map;
}

export const STATE_COLOR: Record<AgentState, string> = {
  ok: "#34d399",
  error: "#f87171",
  stuck: "#fbbf24",
  idle: "#71717a",
};

export const STATE_LABEL: Record<AgentState, string> = {
  ok: "healthy",
  error: "errored",
  stuck: "stuck",
  idle: "idle",
};
