import { NextRequest } from "next/server";
import { subscribe } from "@/lib/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };

      send(`: connected ${new Date().toISOString()}\n\n`);

      const unsubscribe = subscribe((event) => {
        send(`event: agent-event\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const ping = setInterval(() => {
        try {
          send(`: ping ${Date.now()}\n\n`);
        } catch {
          /* controller closed */
        }
      }, 25_000);

      const close = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
