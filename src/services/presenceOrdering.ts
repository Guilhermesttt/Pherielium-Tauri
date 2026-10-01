/**
 * Returns true when an incoming presence event should replace the current state.
 * Missing or invalid timestamps are rejected — receive time must never be used.
 */
export function shouldAcceptPresence(incomingUpdatedAt: number, currentUpdatedAt: number): boolean {
  if (!Number.isFinite(incomingUpdatedAt) || incomingUpdatedAt <= 0) {
    return false;
  }
  if (!Number.isFinite(currentUpdatedAt) || currentUpdatedAt <= 0) {
    return true;
  }
  return incomingUpdatedAt >= currentUpdatedAt;
}

export function parsePresenceUpdatedAt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
}
