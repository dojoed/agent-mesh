import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  from: z.string().min(1).max(120),
  to: z.string().min(1).max(120).optional(),
  type: z.string().min(1).max(60),
  org: z.string().min(1).max(60).optional(),
  toOrg: z.string().min(1).max(60).optional(),
  kind: z.string().max(40).optional(),
  toKind: z.string().max(40).optional(),
  payload: z.unknown().optional(),
});

function unauthorized() {
  return new Response("unauthorized", { status: 401 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.AGENT_MESH_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token !== secret) return unauthorized();
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: "invalid body", detail: String(err) },
      { status: 400 },
    );
  }

  const now = new Date();

  await prisma.agent.upsert({
    where: { id: parsed.from },
    create: {
      id: parsed.from,
      name: parsed.from.split(":").slice(1).join(":") || parsed.from,
      org: parsed.org ?? inferOrg(parsed.from),
      kind: parsed.kind ?? "agent",
      lastSeen: now,
    },
    update: { lastSeen: now, ...(parsed.org ? { org: parsed.org } : {}) },
  });

  if (parsed.to) {
    await prisma.agent.upsert({
      where: { id: parsed.to },
      create: {
        id: parsed.to,
        name: parsed.to.split(":").slice(1).join(":") || parsed.to,
        org: parsed.toOrg ?? inferOrg(parsed.to),
        kind: parsed.toKind ?? "agent",
        lastSeen: now,
      },
      update: parsed.toOrg ? { org: parsed.toOrg } : {},
    });
  }

  const stored = await prisma.event.create({
    data: {
      fromId: parsed.from,
      toId: parsed.to ?? null,
      type: parsed.type,
      payload: (parsed.payload ?? null) as never,
    },
  });

  publish({
    id: stored.id,
    fromId: stored.fromId,
    toId: stored.toId,
    type: stored.type,
    payload: stored.payload,
    createdAt: stored.createdAt.toISOString(),
  });

  return Response.json({ ok: true, id: stored.id });
}

function inferOrg(id: string): string {
  const prefix = id.split(":")[0]?.toLowerCase() ?? "";
  if (prefix.includes("opt-trade") || prefix.includes("stark")) return "stark-delta";
  if (prefix.includes("artifact")) return "artifact";
  return prefix || "default";
}
