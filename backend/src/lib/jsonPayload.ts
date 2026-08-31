// Request.payload is stored as a JSON string column (SQLite has no native Json type).
export function serializePayload(payload: unknown): string {
  return JSON.stringify(payload);
}

export function parsePayload(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}
