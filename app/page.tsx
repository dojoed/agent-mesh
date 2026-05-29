"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentGraph } from "./components/AgentGraph";
import { EventTape } from "./components/EventTape";
import { AgentPanel } from "./components/AgentPanel";
import { MeshHeader } from "./components/MeshHeader";
import type { AgentNode, EventRow, StateSnapshot } from "@/lib/types";

const MAX_EVENTS = 400;

export default function Home() {
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [liveEvent, setLiveEvent] = useState<EventRow | null>(null);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const eventsRef = useRef<EventRow[]>([]);
  const agentsRef = useRef<AgentNode[]>([]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/state")
      .then((r) => r.json() as Promise<StateSnapshot>)
      .then((snap) => {
        if (cancelled) return;
        setAgents(snap.agents);
        setEvents(snap.events);
      })
      .catch(() => {
        /* initial state fetch failed; UI still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));
    source.addEventListener("agent-event", (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data) as EventRow;
        ingestEvent(data);
      } catch {
        /* malformed */
      }
    });
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ingestEvent = useCallback((data: EventRow) => {
    // Touch agents that we haven't seen yet (the server upserted them already;
    // we only have the snapshot so far). Trigger a lightweight refetch.
    const haveFrom = agentsRef.current.some((a) => a.id === data.fromId);
    const haveTo = data.toId
      ? agentsRef.current.some((a) => a.id === data.toId)
      : true;
    if (!haveFrom || !haveTo) {
      fetch("/api/state")
        .then((r) => r.json() as Promise<StateSnapshot>)
        .then((snap) => setAgents(snap.agents))
        .catch(() => {});
    }
    setEvents((prev) => {
      const next = [...prev, data];
      if (next.length > MAX_EVENTS) next.splice(0, next.length - MAX_EVENTS);
      return next;
    });
    setLiveEvent(data);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AgentGraph
        agents={agents}
        events={events}
        liveEvent={liveEvent}
        onSelect={setSelected}
      />

      <div className="absolute top-4 left-4 right-4 z-10 pointer-events-none">
        <MeshHeader
          agents={agents}
          connected={connected}
          eventsTotal={events.length}
        />
      </div>

      {selected && (
        <div className="absolute top-24 right-4 z-10">
          <AgentPanel
            agentId={selected}
            agents={agents}
            events={events}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <EventTape events={events} agents={agents} />
        </div>
      </div>

      {agents.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-xl px-6 py-5 max-w-md text-center">
            <div className="chip text-cyan-300 mb-2">waiting for agents</div>
            <div className="text-sm text-zinc-300">
              No agents have reported yet. Wire up{" "}
              <code className="text-cyan-300 font-mono">reportEvent()</code>{" "}
              from any project and the mesh will populate live.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
