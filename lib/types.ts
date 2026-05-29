export type AgentNode = {
  id: string;
  name: string;
  org: string;
  kind: string;
  color: string | null;
  lastSeen: string;
};

export type EventRow = {
  id: string;
  fromId: string;
  toId: string | null;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type StateSnapshot = {
  agents: AgentNode[];
  events: EventRow[];
};
