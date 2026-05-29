type Subscriber = (event: BroadcastEvent) => void;

export type BroadcastEvent = {
  id: string;
  fromId: string;
  toId: string | null;
  type: string;
  payload: unknown;
  createdAt: string;
};

const subscribers = new Set<Subscriber>();

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function publish(event: BroadcastEvent): void {
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      // a single bad subscriber must not block the rest
    }
  }
}
