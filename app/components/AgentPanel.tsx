"use client";

import { useMemo } from "react";
import type { AgentNode, EventRow } from "@/lib/types";
import { colorForOrg } from "@/lib/colors";

type Props = {
  agentId: string | null;
  agents: AgentNode[];
  events: EventRow[];
  onClose: () => void;
};

export function AgentPanel({ agentId, agents, events, onClose }: Props) {
  const agent = useMemo(
    () => (agentId ? agents.find((a) => a.id === agentId) : null),
    [agentId, agents],
  );

  const related = useMemo(() => {
    if (!agentId) return [];
    return events
      .filter((e) => e.fromId === agentId || e.toId === agentId)
      .slice(-15)
      .reverse();
  }, [agentId, events]);

  if (!agent) return null;

  const color = agent.color ?? colorForOrg(agent.org);

  return (
    <div className="glass rounded-xl p-5 w-[340px] max-h-[60vh] overflow-y-auto pointer-events-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            />
            <span className="chip text-zinc-400">{agent.org}</span>
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight">
            {agent.name}
          </div>
          <div className="text-xs text-zinc-500 font-mono">{agent.id}</div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 text-sm"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <Stat label="Kind" value={agent.kind} />
        <Stat label="Last seen" value={timeAgo(agent.lastSeen)} />
      </div>

      <div className="mt-5">
        <div className="chip text-zinc-500 mb-2">Recent activity</div>
        {related.length === 0 ? (
          <div className="text-xs text-zinc-500 italic">no events</div>
        ) : (
          <ul className="space-y-1.5">
            {related.map((e) => (
              <li key={e.id} className="tape-row text-zinc-300">
                <span className="text-zinc-500 mr-2">
                  {new Date(e.createdAt).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className="text-cyan-300">{e.type}</span>
                {e.fromId === agent.id && e.toId && (
                  <span className="text-zinc-500"> → {e.toId}</span>
                )}
                {e.toId === agent.id && (
                  <span className="text-zinc-500"> ← {e.fromId}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="chip text-zinc-500">{label}</div>
      <div className="text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
