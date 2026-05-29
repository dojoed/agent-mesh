# Agent Mesh

A live, neon-galaxy view of every agent running across Stark Delta and Artifact.
Force-directed graph, clustered by org, with animated particles flowing along
edges every time one agent talks to another.

## Local dev

```bash
cp .env.example .env
# set DATABASE_URL to a local or Render Postgres URL (must include ?sslmode=require for Render)
npm install
npm run dev   # http://localhost:3002
```

## Wiring an agent into the mesh

Drop this into any project — Node, edge, anywhere with `fetch`:

```ts
const MESH = process.env.AGENT_MESH_URL!;       // e.g. https://agent-mesh.onrender.com
const SECRET = process.env.AGENT_MESH_SECRET!;

export async function reportEvent(args: {
  from: string;          // e.g. "opt-trade:trade"
  to?: string;           // e.g. "opt-trade:monitor"
  type: string;          // e.g. "run_start" | "order_placed" | "message"
  org?: string;          // "stark-delta" | "artifact" (inferred if omitted)
  toOrg?: string;
  kind?: string;         // free-form: "agent" | "cron" | "webhook"
  payload?: unknown;
}) {
  try {
    await fetch(`${MESH}/api/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify(args),
      keepalive: true,
    });
  } catch {
    /* fire-and-forget */
  }
}
```

Agents are upserted on first sight — no separate registration step.
