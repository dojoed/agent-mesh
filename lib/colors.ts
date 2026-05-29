export const ORG_COLORS: Record<string, string> = {
  "stark-delta": "#22d3ee",
  "stark delta": "#22d3ee",
  artifact: "#e879f9",
  default: "#a78bfa",
};

export function colorForOrg(org: string): string {
  const key = org.toLowerCase();
  return ORG_COLORS[key] ?? ORG_COLORS.default;
}
