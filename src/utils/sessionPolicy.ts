export const PENDING_LAUNCH_MAX_AGE_MS = 3 * 60 * 1000;

export function isValidSessionPid(pid?: number | null): boolean {
  return typeof pid === "number" && Number.isFinite(pid) && pid > 0;
}

export function canConfirmSession(options: {
  confirmed?: boolean;
  executablePath?: string | null;
  pid?: number | null;
}): boolean {
  return Boolean(
    options.confirmed
    && options.executablePath
    && isValidSessionPid(options.pid),
  );
}

export function isPendingLaunchRecent(
  launchedAt?: number | null,
  maxAgeMs: number = PENDING_LAUNCH_MAX_AGE_MS,
): boolean {
  if (!launchedAt || launchedAt <= 0) return false;
  return Date.now() - launchedAt <= maxAgeMs;
}

export function shouldAllowBackgroundSessionConfirm(options: {
  pendingLaunchedAt?: number | null;
  hasActiveSession: boolean;
  pid?: number | null;
}): boolean {
  if (!isValidSessionPid(options.pid)) return false;
  if (options.hasActiveSession) return true;
  return isPendingLaunchRecent(options.pendingLaunchedAt);
}
