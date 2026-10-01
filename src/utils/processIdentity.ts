export interface RunningProcessMatch {
  requestedPath: string;
  matchedPath: string;
  pid: number;
  processStartTimeMs?: number | null;
}

export function normalizeExecutablePath(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .toLowerCase()
    .replace(/\/+$/, "");
}

export function executablePathsEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeExecutablePath(left);
  const normalizedRight = normalizeExecutablePath(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
