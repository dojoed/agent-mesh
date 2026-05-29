import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [agents, events] = await Promise.all([
    prisma.agent.findMany({ orderBy: { lastSeen: "desc" } }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return Response.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      org: a.org,
      kind: a.kind,
      color: a.color,
      lastSeen: a.lastSeen.toISOString(),
    })),
    events: events
      .map((e) => ({
        id: e.id,
        fromId: e.fromId,
        toId: e.toId,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt.toISOString(),
      }))
      .reverse(),
  });
}
