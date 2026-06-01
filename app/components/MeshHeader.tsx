"use client";

import { useMemo } from "react";
import { colorForOrg } from "@/lib/colors";
import { type AgentStatus, STATE_COLOR } from "@/lib/status";
import type { AgentNode } from "@/lib/types";

type Props = {
  agents: AgentNode[];
  connected: boolean;
  eventsTotal: number;
  statusByAgent: Map<string, AgentStatus>;
};

export function MeshHeader({
  agents,
  connected,
  eventsTotal,
  statusByAgent,
}: Props) {
  const orgs = useMemo(() => {
    const groups = new Map<string, number>();
    for (const a of agents) groups.set(a.org, (groups.get(a.org) ?? 0) + 1);
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [agents]);

  const failing = useMemo(() => {
    let n = 0;
    for (const s of statusByAgent.values()) {
      if (s.state === "error" || s.state === "stuck") n += 1;
    }
    return n;
  }, [statusByAgent]);

  return (
    <div className="glass rounded-xl px-5 py-3 flex items-center gap-5 pointer-events-auto">
      <div>
        <div className="text-base font-semibold tracking-tight">
          Agent Mesh
        </div>
        <div className="chip text-zinc-500 mt-0.5">live multi-agent activity</div>
      </div>
      <div className="h-9 w-px bg-white/10" />
      <div className="flex items-center gap-3">
        {orgs.map(([org, count]) => (
          <div key={org} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: colorForOrg(org),
                boxShadow: `0 0 10px ${colorForOrg(org)}`,
              }}
            />
            <span className="text-xs text-zinc-300">{org}</span>
            <span className="chip text-zinc-500">{count}</span>
          </div>
        ))}
        {orgs.length === 0 && (
          <span className="text-xs text-zinc-500 italic">
            no agents reporting yet
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {failing > 0 ? (
          <span
            className="chip flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              color: STATE_COLOR.error,
              background: "rgba(248,113,113,0.12)",
              border: `1px solid ${STATE_COLOR.error}55`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: STATE_COLOR.error,
                boxShadow: `0 0 8px ${STATE_COLOR.error}`,
              }}
            />
            {failing} failing
          </span>
        ) : (
          agents.length > 0 && (
            <span
              className="chip flex items-center gap-1.5"
              style={{ color: STATE_COLOR.ok }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: STATE_COLOR.ok,
                  boxShadow: `0 0 8px ${STATE_COLOR.ok}`,
                }}
              />
              all healthy
            </span>
          )
        )}
        <span className="mx-1 h-3 w-px bg-white/10" />
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-emerald-400" : "bg-zinc-600"
          }`}
          style={
            connected
              ? { boxShadow: "0 0 10px rgba(52, 211, 153, 0.8)" }
              : undefined
          }
        />
        <span className="chip text-zinc-400">
          {connected ? "stream live" : "disconnected"}
        </span>
        <span className="chip text-zinc-600">· {eventsTotal} events</span>
      </div>
    </div>
  );
}
