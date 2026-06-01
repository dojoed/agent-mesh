"use client";

import { useMemo, useState } from "react";
import type { AgentNode, EventRow } from "@/lib/types";
import { colorForOrg } from "@/lib/colors";

type Props = {
  events: EventRow[];
  agents: AgentNode[];
};

export function EventTape({ events, agents }: Props) {
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const nameMap = useMemo(() => {
    const m = new Map<string, AgentNode>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const orgs = useMemo(
    () => Array.from(new Set(agents.map((a) => a.org))).sort(),
    [agents],
  );

  // Most-frequent event types first, so the useful chips surface to the front.
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t]) => t);
  }, [events]);

  const orgOf = (id: string | null) =>
    id ? nameMap.get(id)?.org ?? null : null;

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (orgFilter) {
        const fromOrg = orgOf(e.fromId);
        const toOrg = orgOf(e.toId);
        if (fromOrg !== orgFilter && toOrg !== orgFilter) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, orgFilter, typeFilter, nameMap]);

  const recent = filtered.slice(-60).reverse();
  const hasFilter = orgFilter !== null || typeFilter !== null;

  return (
    <div className="glass rounded-xl px-4 py-3 max-h-56 overflow-hidden">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="pulse-dot" />
        <span className="chip text-cyan-300">Event tape</span>
        <span className="chip text-zinc-500">
          {hasFilter ? `${recent.length} / ${events.length}` : `last ${recent.length}`}
        </span>

        <span className="mx-1 h-3 w-px bg-white/10" />

        {orgs.map((org) => (
          <FilterChip
            key={org}
            active={orgFilter === org}
            color={colorForOrg(org)}
            onClick={() => setOrgFilter((cur) => (cur === org ? null : org))}
          >
            {org}
          </FilterChip>
        ))}

        {types.length > 0 && <span className="mx-1 h-3 w-px bg-white/10" />}

        {types.map((t) => (
          <FilterChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter((cur) => (cur === t ? null : t))}
          >
            {t}
          </FilterChip>
        ))}

        {hasFilter && (
          <button
            onClick={() => {
              setOrgFilter(null);
              setTypeFilter(null);
            }}
            className="chip text-zinc-500 hover:text-zinc-200 ml-1"
          >
            clear ✕
          </button>
        )}
      </div>

      <div className="scroll-fade overflow-y-auto max-h-32 pr-2">
        {recent.length === 0 ? (
          <div className="tape-row text-zinc-500 italic">
            {events.length === 0
              ? "no events yet — instrument an agent to start streaming"
              : "no events match this filter"}
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

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
        active
          ? "border-white/40 text-zinc-100 bg-white/10"
          : "border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
      }`}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: color, boxShadow: active ? `0 0 8px ${color}` : undefined }}
        />
      )}
      {children}
    </button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false });
}
