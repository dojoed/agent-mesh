"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceX, forceY } from "d3-force";
import { colorForOrg } from "@/lib/colors";
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
  onSelect: (id: string | null) => void;
};

export function AgentGraph({ agents, events, liveEvent, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const lastActivityRef = useRef<Map<string, number>>(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });

  const data = useMemo(() => {
    const nodes: GraphNode[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      org: a.org,
      kind: a.kind,
      color: a.color ?? colorForOrg(a.org),
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
          linkColor={((l: any) => withAlpha((l as GraphLink).color, 0.35)) as never}
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
          nodeCanvasObject={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((rawNode: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const node = rawNode as GraphNode;
              const now = Date.now();
              const lastAct = lastActivityRef.current.get(node.id) ?? 0;
              const since = now - lastAct;
              const pulse = since < 1800 ? Math.max(0, 1 - since / 1800) : 0;
              const baseR = 6;
              const r = baseR + pulse * 6;
              const x = node.x ?? 0;
              const y = node.y ?? 0;

              const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
              grd.addColorStop(0, withAlpha(node.color, 0.55 + pulse * 0.4));
              grd.addColorStop(0.5, withAlpha(node.color, 0.12));
              grd.addColorStop(1, withAlpha(node.color, 0));
              ctx.fillStyle = grd;
              ctx.beginPath();
              ctx.arc(x, y, r * 4, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = node.color;
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = "rgba(255,255,255,0.85)";
              ctx.beginPath();
              ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
              ctx.fill();

              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `${fontSize}px var(--font-geist-mono), ui-monospace, monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = withAlpha("#e5e7ff", 0.9);
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
