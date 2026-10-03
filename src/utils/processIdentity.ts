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

/** True when `actual` is the same executable or lives under an install directory root. */
export function monitorPathsRelated(
  root: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  if (executablePathsEqual(root, actual)) return true;
  const normalizedRoot = normalizeExecutablePath(root);
  const normalizedActual = normalizeExecutablePath(actual);
  if (!normalizedRoot || !normalizedActual) return false;
  return normalizedActual.startsWith(`${normalizedRoot}/`);
}
