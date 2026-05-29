"use client";

import { useMemo } from "react";
import type { AgentNode, EventRow } from "@/lib/types";
import { colorForOrg } from "@/lib/colors";

type Props = {
  events: EventRow[];
  agents: AgentNode[];
};

export function EventTape({ events, agents }: Props) {
  const nameMap = useMemo(() => {
    const m = new Map<string, AgentNode>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const recent = events.slice(-60).reverse();

  return (
    <div className="glass rounded-xl px-4 py-3 max-h-44 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <span className="pulse-dot" />
        <span className="chip text-cyan-300">Event tape</span>
        <span className="chip text-zinc-500">last {recent.length}</span>
      </div>
      <div className="scroll-fade overflow-y-auto max-h-32 pr-2">
        {recent.length === 0 ? (
          <div className="tape-row text-zinc-500 italic">
            no events yet — instrument an agent to start streaming
          </div>
        ) : (
          recent.map((e) => {
            const from = nameMap.get(e.fromId);
            const to = e.toId ? nameMap.get(e.toId) : null;
            const fromColor = from ? colorForOrg(from.org) : "#a78bfa";
            return (
              <div key={e.id} className="tape-row flex gap-3">
                <span className="text-zinc-500 shrink-0 w-16">
                  {formatTime(e.createdAt)}
                </span>
                <span style={{ color: fromColor }} className="shrink-0">
                  {from?.name ?? e.fromId}
                </span>
                <span className="text-zinc-500 shrink-0">{e.type}</span>
                {to && (
                  <>
                    <span className="text-zinc-600">→</span>
                    <span
                      style={{ color: colorForOrg(to.org) }}
                      className="shrink-0"
                    >
                      {to.name}
                    </span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false });
}
