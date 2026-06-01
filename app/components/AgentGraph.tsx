"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceX, forceY } from "d3-force";
import { colorForOrg } from "@/lib/colors";
import { type AgentStatus, STATE_COLOR } from "@/lib/status";
import type { AgentNode, EventRow } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => null,
});

type GraphNode = {
  id: string;
  name: string;
  org: string;
  kind: string;
  color: string;
  lastSeen: number;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  count: number;
  color: string;
};

type Props = {
  agents: AgentNode[];
  events: EventRow[];
  liveEvent: EventRow | null;
  selected: string | null;
  statusByAgent: Map<string, AgentStatus>;
  onSelect: (id: string | null) => void;
};

// Recency drives how alive a node looks: full brightness for the last 5 min of
// activity, fading to a dim "ghost" floor by the 60-min mark. Combined with the
// per-event pulse, this lets the eye instantly find what's running *now*.
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;
const GHOST_FLOOR = 0.16;

function recencyAlpha(ageMs: number): number {
  if (ageMs <= FRESH_MS) return 1;
  if (ageMs >= STALE_MS) return GHOST_FLOOR;
  const t = (ageMs - FRESH_MS) / (STALE_MS - FRESH_MS);
  return 1 - t * (1 - GHOST_FLOOR);
}

export function AgentGraph({
  agents,
  events,
  liveEvent,
  selected,
  statusByAgent,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const lastActivityRef = useRef<Map<string, number>>(new Map());
  // Read by the continuously-redrawing canvas, so health changes show up
  // without rebuilding the accessors.
  const statusRef = useRef(statusByAgent);
  statusRef.current = statusByAgent;
  // Focus state (hovered, else selected) + its neighbour set, read by the
  // canvas/link accessors. Kept in a ref so we don't rebuild the accessors —
  // the simulation runs continuously and reads the latest value each frame.
  const focusRef = useRef<{ id: string | null; neighbors: Set<string> }>({
    id: null,
    neighbors: new Set(),
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const data = useMemo(() => {
    const nodes: GraphNode[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      org: a.org,
      kind: a.kind,
      color: a.color ?? colorForOrg(a.org),
      lastSeen: new Date(a.lastSeen).getTime(),
    }));

    const linkMap = new Map<string, GraphLink>();
    for (const e of events) {
      if (!e.toId) continue;
      const key = `${e.fromId}->${e.toId}`;
      const existing = linkMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const fromAgent = agents.find((a) => a.id === e.fromId);
        linkMap.set(key, {
          source: e.fromId,
          target: e.toId,
          count: 1,
          color: fromAgent ? colorForOrg(fromAgent.org) : "#a78bfa",
        });
      }
    }
    return { nodes, links: Array.from(linkMap.values()) };
  }, [agents, events]);

  // Recompute the focus + neighbour set whenever the hover/selection or the
  // edge set changes.
  useEffect(() => {
    const id = hoveredId ?? selected;
    const neighbors = new Set<string>();
    if (id) {
      neighbors.add(id);
      for (const l of data.links) {
        const s = asId(l.source);
        const t = asId(l.target);
        if (s === id) neighbors.add(t);
        if (t === id) neighbors.add(s);
      }
    }
    focusRef.current = { id, neighbors };
  }, [hoveredId, selected, data.links]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const anchors = computeAnchors(data.nodes);
    try {
      graph.d3Force(
        "x",
        forceX<GraphNode>((n) => anchors[n.org]?.x ?? 0).strength(0.09),
      );
      graph.d3Force(
        "y",
        forceY<GraphNode>((n) => anchors[n.org]?.y ?? 0).strength(0.09),
      );
      const charge = graph.d3Force("charge");
      if (charge) charge.strength(-180);
      graph.d3ReheatSimulation?.();
    } catch {
      /* graph not ready yet */
    }
  }, [data.nodes]);

  useEffect(() => {
    if (!liveEvent) return;
    lastActivityRef.current.set(liveEvent.fromId, Date.now());
    if (liveEvent.toId) {
      lastActivityRef.current.set(liveEvent.toId, Date.now());
      const link = data.links.find(
        (l) =>
          asId(l.source) === liveEvent.fromId &&
          asId(l.target) === liveEvent.toId,
      );
      if (link && graphRef.current?.emitParticle) {
        try {
          graphRef.current.emitParticle(link);
        } catch {
          /* ignore */
        }
      }
    }
  }, [liveEvent, data.links]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size.width > 0 && size.height > 0 ? (
        // The library's generic types are lost across the dynamic() boundary,
        // so we widen accessor params to `any` and narrow inside.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <ForceGraph2D
          ref={graphRef}
          graphData={data as never}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={6}
          cooldownTime={Infinity}
          d3VelocityDecay={0.35}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkColor={((l: any) => {
            const link = l as GraphLink;
            const { id, neighbors } = focusRef.current;
            const alpha = id
              ? neighbors.has(asId(link.source)) && neighbors.has(asId(link.target))
                ? 0.55
                : 0.05
              : 0.32;
            return withAlpha(link.color, alpha);
          }) as never}
          linkWidth={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((l: any) =>
              0.6 +
              Math.min(1.8, Math.log2(((l as GraphLink).count ?? 1) + 1) * 0.4)) as never
          }
          linkDirectionalParticles={0}
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleSpeed={0.012}
          linkDirectionalParticleColor={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((l: any) => (l as GraphLink).color) as never
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeClick={((node: any) => onSelect((node as GraphNode).id)) as never}
          onBackgroundClick={(() => onSelect(null)) as never}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeHover={((node: any) => {
            setHoveredId(node ? (node as GraphNode).id : null);
            if (containerRef.current) {
              containerRef.current.style.cursor = node ? "pointer" : "default";
            }
          }) as never}
          nodeCanvasObject={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((rawNode: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const node = rawNode as GraphNode;
              const now = Date.now();
              const lastAct = Math.max(
                lastActivityRef.current.get(node.id) ?? 0,
                node.lastSeen,
              );
              const since = now - lastAct;
              const pulse = since < 1800 ? Math.max(0, 1 - since / 1800) : 0;

              // Idle nodes dim toward a ghost floor; the focused node and its
              // neighbours stay lit while everything else recedes.
              const { id: focusId, neighbors } = focusRef.current;
              const recency = recencyAlpha(since);
              const focusMul = !focusId ? 1 : neighbors.has(node.id) ? 1 : 0.12;
              const isFocus = focusId === node.id;

              // Health overrides looks: errored/stuck nodes glow in their alert
              // colour and refuse to dim, so a failure is impossible to miss.
              const status = statusRef.current.get(node.id);
              const alert =
                status?.state === "error" || status?.state === "stuck";
              const drawColor = alert ? STATE_COLOR[status!.state] : node.color;
              const baseAlive = Math.min(1, recency + pulse) * focusMul;
              const alive = alert ? Math.max(baseAlive, 0.95) : baseAlive;

              const baseR = 6;
              const r = baseR + pulse * 6;
              const x = node.x ?? 0;
              const y = node.y ?? 0;

              const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
              grd.addColorStop(0, withAlpha(drawColor, (0.5 + pulse * 0.4) * alive));
              grd.addColorStop(0.5, withAlpha(drawColor, 0.12 * alive));
              grd.addColorStop(1, withAlpha(drawColor, 0));
              ctx.fillStyle = grd;
              ctx.beginPath();
              ctx.arc(x, y, r * 4, 0, Math.PI * 2);
              ctx.fill();

              // Pulsing alert ring on unhealthy agents.
              if (alert) {
                const beat = 0.5 + 0.5 * Math.sin(now / 320);
                ctx.strokeStyle = withAlpha(drawColor, 0.4 + 0.5 * beat);
                ctx.lineWidth = 2 / globalScale;
                ctx.beginPath();
                ctx.arc(x, y, r + 5 + beat * 4, 0, Math.PI * 2);
                ctx.stroke();
              }

              // Selection / hover ring.
              if (isFocus) {
                ctx.strokeStyle = withAlpha("#ffffff", 0.85);
                ctx.lineWidth = 1.5 / globalScale;
                ctx.beginPath();
                ctx.arc(x, y, r + 4, 0, Math.PI * 2);
                ctx.stroke();
              }

              ctx.fillStyle = withAlpha(drawColor, Math.max(GHOST_FLOOR, alive));
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = withAlpha("#ffffff", 0.85 * alive);
              ctx.beginPath();
              ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
              ctx.fill();

              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `${fontSize}px var(--font-geist-mono), ui-monospace, monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = withAlpha("#e5e7ff", 0.9 * Math.max(0.35, alive));
              ctx.fillText(node.name, x, y + r + 6);
            }) as never
          }
          nodePointerAreaPaint={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((rawNode: any, color: string, ctx: CanvasRenderingContext2D) => {
              const node = rawNode as GraphNode;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, 14, 0, Math.PI * 2);
              ctx.fill();
            }) as never
          }
        />
      ) : null}
    </div>
  );
}

function asId(v: string | { id: string }): string {
  return typeof v === "string" ? v : v.id;
}

function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("rgba")) return hex;
  if (!hex.startsWith("#") || hex.length !== 7) {
    return `rgba(167, 139, 250, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function computeAnchors(
  nodes: GraphNode[],
): Record<string, { x: number; y: number }> {
  const orgs = Array.from(new Set(nodes.map((n) => n.org))).sort();
  const anchors: Record<string, { x: number; y: number }> = {};
  const spread = 280;
  if (orgs.length === 1) {
    anchors[orgs[0]] = { x: 0, y: 0 };
    return anchors;
  }
  orgs.forEach((org, i) => {
    if (orgs.length === 2) {
      anchors[org] = { x: i === 0 ? -spread : spread, y: 0 };
    } else {
      const theta = (i / orgs.length) * Math.PI * 2;
      anchors[org] = { x: Math.cos(theta) * spread, y: Math.sin(theta) * spread };
    }
  });
  return anchors;
}
